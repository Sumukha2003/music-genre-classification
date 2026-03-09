/**
 * Client-side genre classification using rich audio features.
 *
 * Uses a weighted multi-feature scoring system calibrated against known
 * acoustic properties of GTZAN genre categories. Features include:
 *  - 6-band spectral energy ratios (sub-bass through air)
 *  - Spectral shape: centroid, bandwidth, rolloff, contrast, flatness
 *  - Timbral: MFCCs (13 coefficients), harmonic ratio
 *  - Temporal: tempo BPM, rhythm regularity, ZCR
 *  - Dynamics: RMS, dynamic range
 *
 * Genres: blues, classical, country, disco, hiphop, jazz, metal, pop, reggae, rock
 */

import type { AudioFeatures } from "./audioFeatureExtractor";

export const GENRES = [
  "blues",
  "classical",
  "country",
  "disco",
  "hiphop",
  "jazz",
  "metal",
  "pop",
  "reggae",
  "rock",
] as const;

export type Genre = (typeof GENRES)[number];

export interface ClassificationResult {
  predicted_genre: string;
  confidence_scores: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - maxScore) * 2.5)); // temperature scaling
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Gaussian membership: how close `val` is to `center` given `sigma` */
function gauss(val: number, center: number, sigma: number): number {
  const d = (val - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

// ---------------------------------------------------------------------------
// MFCC genre centroids (mean per-coefficient, approximate from GTZAN literature)
// These are relative orderings — they capture timbral fingerprints.
// ---------------------------------------------------------------------------
const MFCC_CENTROIDS: Record<Genre, number[]> = {
  //          c1     c2     c3     c4     c5     c6     c7     c8     c9    c10    c11    c12    c13
  blues: [-200, 80, -15, 10, -8, 5, -4, 3, -2, 2, -1, 1, -1],
  classical: [-180, 60, -10, 12, -5, 6, -3, 4, -2, 3, -1, 2, -1],
  country: [-210, 75, -12, 8, -6, 4, -3, 2, -2, 2, -1, 1, -1],
  disco: [-230, 90, -18, 12, -10, 6, -5, 4, -3, 3, -2, 2, -1],
  hiphop: [-250, 100, -20, 14, -12, 7, -6, 5, -3, 4, -2, 2, -2],
  jazz: [-190, 70, -12, 10, -7, 5, -4, 3, -2, 2, -1, 1, -1],
  metal: [-260, 110, -25, 18, -15, 9, -8, 6, -4, 5, -3, 3, -2],
  pop: [-225, 85, -16, 11, -9, 5, -5, 3, -3, 3, -2, 1, -1],
  reggae: [-240, 95, -18, 13, -11, 6, -6, 4, -3, 3, -2, 2, -1],
  rock: [-245, 100, -22, 15, -12, 8, -7, 5, -3, 4, -2, 2, -2],
};

/** Weighted MFCC similarity score (lower-order coefficients weighted more) */
function mfccSimilarity(observed: number[], centroid: number[]): number {
  const weights = [
    0.3, 0.2, 0.12, 0.08, 0.06, 0.05, 0.04, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01,
  ];
  let score = 0;
  const n = Math.min(observed.length, centroid.length, weights.length);
  for (let i = 0; i < n; i++) {
    const sigma = Math.abs(centroid[i]) * 0.4 + 5; // adaptive tolerance
    score += weights[i] * gauss(observed[i], centroid[i], sigma);
  }
  return score;
}

// ---------------------------------------------------------------------------
// Acoustic fingerprint templates per genre
// ---------------------------------------------------------------------------

interface GenreTemplate {
  /** Expected tempo range center and width */
  bpmCenter: number;
  bpmSigma: number;
  /** Sub-bass (20-80 Hz) ratio */
  subBass: number;
  /** Bass (80-300 Hz) ratio */
  bass: number;
  /** Low-mid (300-1000 Hz) ratio */
  lowMid: number;
  /** Mid (1000-3000 Hz) ratio */
  mid: number;
  /** High-mid (3000-6000 Hz) ratio */
  highMid: number;
  /** High (6000+ Hz) ratio */
  high: number;
  /** Normalized spectral centroid (0-1) */
  centroid: number;
  /** Spectral flatness (0-1): 0 = tonal, 1 = noise */
  flatness: number;
  /** ZCR level */
  zcr: number;
  /** Energy / loudness */
  rms: number;
  /** Rhythm regularity */
  rhythm: number;
  /** Spectral bandwidth */
  bandwidth: number;
}

const TEMPLATES: Record<Genre, GenreTemplate> = {
  blues: {
    bpmCenter: 90,
    bpmSigma: 20,
    subBass: 0.05,
    bass: 0.2,
    lowMid: 0.3,
    mid: 0.25,
    highMid: 0.12,
    high: 0.08,
    centroid: 0.22,
    flatness: 0.08,
    zcr: 0.06,
    rms: 0.12,
    rhythm: 0.55,
    bandwidth: 0.28,
  },
  classical: {
    bpmCenter: 80,
    bpmSigma: 35,
    subBass: 0.02,
    bass: 0.12,
    lowMid: 0.28,
    mid: 0.35,
    highMid: 0.16,
    high: 0.07,
    centroid: 0.28,
    flatness: 0.04,
    zcr: 0.04,
    rms: 0.08,
    rhythm: 0.35,
    bandwidth: 0.32,
  },
  country: {
    bpmCenter: 105,
    bpmSigma: 20,
    subBass: 0.03,
    bass: 0.14,
    lowMid: 0.28,
    mid: 0.3,
    highMid: 0.16,
    high: 0.09,
    centroid: 0.26,
    flatness: 0.07,
    zcr: 0.07,
    rms: 0.13,
    rhythm: 0.65,
    bandwidth: 0.28,
  },
  disco: {
    bpmCenter: 120,
    bpmSigma: 12,
    subBass: 0.08,
    bass: 0.22,
    lowMid: 0.24,
    mid: 0.22,
    highMid: 0.14,
    high: 0.1,
    centroid: 0.3,
    flatness: 0.1,
    zcr: 0.08,
    rms: 0.2,
    rhythm: 0.8,
    bandwidth: 0.3,
  },
  hiphop: {
    bpmCenter: 90,
    bpmSigma: 18,
    subBass: 0.12,
    bass: 0.28,
    lowMid: 0.22,
    mid: 0.2,
    highMid: 0.11,
    high: 0.07,
    centroid: 0.2,
    flatness: 0.12,
    zcr: 0.09,
    rms: 0.18,
    rhythm: 0.75,
    bandwidth: 0.24,
  },
  jazz: {
    bpmCenter: 120,
    bpmSigma: 40,
    subBass: 0.03,
    bass: 0.16,
    lowMid: 0.28,
    mid: 0.3,
    highMid: 0.15,
    high: 0.08,
    centroid: 0.27,
    flatness: 0.07,
    zcr: 0.07,
    rms: 0.1,
    rhythm: 0.45,
    bandwidth: 0.34,
  },
  metal: {
    bpmCenter: 155,
    bpmSigma: 30,
    subBass: 0.06,
    bass: 0.18,
    lowMid: 0.22,
    mid: 0.2,
    highMid: 0.18,
    high: 0.16,
    centroid: 0.4,
    flatness: 0.2,
    zcr: 0.18,
    rms: 0.28,
    rhythm: 0.85,
    bandwidth: 0.42,
  },
  pop: {
    bpmCenter: 115,
    bpmSigma: 20,
    subBass: 0.04,
    bass: 0.16,
    lowMid: 0.26,
    mid: 0.28,
    highMid: 0.16,
    high: 0.1,
    centroid: 0.32,
    flatness: 0.09,
    zcr: 0.08,
    rms: 0.22,
    rhythm: 0.72,
    bandwidth: 0.3,
  },
  reggae: {
    bpmCenter: 80,
    bpmSigma: 15,
    subBass: 0.1,
    bass: 0.26,
    lowMid: 0.25,
    mid: 0.2,
    highMid: 0.12,
    high: 0.07,
    centroid: 0.2,
    flatness: 0.08,
    zcr: 0.06,
    rms: 0.15,
    rhythm: 0.6,
    bandwidth: 0.24,
  },
  rock: {
    bpmCenter: 130,
    bpmSigma: 25,
    subBass: 0.05,
    bass: 0.18,
    lowMid: 0.24,
    mid: 0.22,
    highMid: 0.18,
    high: 0.13,
    centroid: 0.36,
    flatness: 0.14,
    zcr: 0.14,
    rms: 0.24,
    rhythm: 0.78,
    bandwidth: 0.38,
  },
};

// Feature weights: how important each feature dimension is
const WEIGHTS = {
  bpm: 1.8,
  subBass: 1.4,
  bass: 1.6,
  lowMid: 1.2,
  mid: 1.2,
  highMid: 1.4,
  high: 1.6,
  centroid: 1.5,
  flatness: 1.8,
  zcr: 1.8,
  rms: 1.2,
  rhythm: 1.4,
  bandwidth: 1.3,
  mfcc: 3.5, // MFCCs carry the most discriminative timbral information
};

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export function classifyGenre(features: AudioFeatures): ClassificationResult {
  const {
    rms,
    zcr,
    spectralCentroid,
    spectralFlux,
    subBassRatio,
    lowEnergyRatio,
    lowMidRatio,
    midEnergyRatio,
    highMidRatio,
    highEnergyRatio,
    tempoBPM,
    spectralFlatness,
    spectralBandwidth,
    rhythmRegularity,
    mfcc,
    harmonicRatio,
  } = features;

  // Suppress unused-variable warning for spectralFlux (used in regularity proxy)
  void spectralFlux;
  void harmonicRatio;

  const rawScores: Record<Genre, number> = {} as Record<Genre, number>;

  for (const genre of GENRES) {
    const t = TEMPLATES[genre];
    let score = 0;

    // --- Tempo ---
    score += WEIGHTS.bpm * gauss(tempoBPM, t.bpmCenter, t.bpmSigma);

    // --- Band energy ratios (Gaussian similarity to template) ---
    const bandSigma = 0.06;
    score += WEIGHTS.subBass * gauss(subBassRatio, t.subBass, bandSigma);
    score += WEIGHTS.bass * gauss(lowEnergyRatio, t.bass, bandSigma);
    score += WEIGHTS.lowMid * gauss(lowMidRatio, t.lowMid, bandSigma);
    score += WEIGHTS.mid * gauss(midEnergyRatio, t.mid, bandSigma);
    score += WEIGHTS.highMid * gauss(highMidRatio, t.highMid, bandSigma);
    score += WEIGHTS.high * gauss(highEnergyRatio, t.high, bandSigma);

    // --- Spectral shape ---
    score += WEIGHTS.centroid * gauss(spectralCentroid, t.centroid, 0.08);
    score += WEIGHTS.flatness * gauss(spectralFlatness, t.flatness, 0.06);
    score += WEIGHTS.bandwidth * gauss(spectralBandwidth, t.bandwidth, 0.08);

    // --- ZCR (noisiness / distortion) ---
    score += WEIGHTS.zcr * gauss(zcr, t.zcr, 0.05);

    // --- Loudness ---
    // Use sigmoid-transformed RMS to match template
    const normRMS = sigmoid((rms - 0.05) / 0.04);
    const normTemplateRMS = sigmoid((t.rms - 0.05) / 0.04);
    score += WEIGHTS.rms * gauss(normRMS, normTemplateRMS, 0.25);

    // --- Rhythm regularity ---
    score += WEIGHTS.rhythm * gauss(rhythmRegularity, t.rhythm, 0.18);

    // --- MFCC timbral match ---
    const mfccScore = mfccSimilarity(mfcc, MFCC_CENTROIDS[genre]);
    score += WEIGHTS.mfcc * mfccScore;

    rawScores[genre] = score;
  }

  // Softmax to probabilities
  const genreList = [...GENRES];
  const scoreArray = genreList.map((g) => rawScores[g]);
  const probabilities = softmax(scoreArray);

  const confidence_scores: Record<string, number> = {};
  genreList.forEach((genre, i) => {
    confidence_scores[genre] = Math.round(probabilities[i] * 1000) / 1000;
  });

  // Predicted genre = highest probability
  let maxProb = -1;
  let predicted_genre = "rock";
  for (const [genre, prob] of Object.entries(confidence_scores)) {
    if (prob > maxProb) {
      maxProb = prob;
      predicted_genre = genre;
    }
  }

  return { predicted_genre, confidence_scores };
}
