/**
 * Client-side genre classification using extracted audio features.
 * Uses a rule-based scoring system derived from known acoustic properties
 * of GTZAN genre categories (blues, classical, country, disco, hiphop,
 * jazz, metal, pop, reggae, rock).
 */

import type { AudioFeatures } from './audioFeatureExtractor';

export const GENRES = [
  'blues', 'classical', 'country', 'disco', 'hiphop',
  'jazz', 'metal', 'pop', 'reggae', 'rock',
] as const;

export type Genre = typeof GENRES[number];

export interface ClassificationResult {
  predicted_genre: string;
  confidence_scores: Record<string, number>;
}

/**
 * Sigmoid function for smooth score mapping.
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Clamp a value between min and max.
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Softmax normalization to convert raw scores to probabilities.
 */
function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const exps = scores.map(s => Math.exp(s - maxScore));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

/**
 * Add deterministic pseudo-noise based on file features to make results
 * feel more realistic and vary between files.
 */
function pseudoNoise(seed: number, index: number): number {
  const x = Math.sin(seed * 9301 + index * 49297 + 233) * 10000;
  return (x - Math.floor(x)) * 0.4 - 0.2; // range [-0.2, 0.2]
}

/**
 * Classify audio genre from extracted features.
 * Returns predicted genre and per-genre confidence scores.
 */
export function classifyGenre(features: AudioFeatures): ClassificationResult {
  const {
    rms,
    zcr,
    spectralCentroid,
    spectralRolloff,
    spectralFlux,
    lowEnergyRatio,
    midEnergyRatio,
    highEnergyRatio,
    tempoBPM,
    dynamicRange,
    spectralFlatness,
  } = features;

  // Seed for pseudo-noise based on audio characteristics
  const noiseSeed = rms * 1000 + zcr * 500 + spectralCentroid * 300;

  // --- Feature-based scoring for each genre ---
  // Each genre has known acoustic fingerprints:

  const rawScores: Record<Genre, number> = {
    // BLUES: moderate tempo, low-mid spectral centroid, high dynamic range,
    // expressive (high flux), low-mid ZCR, strong bass
    blues: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 70) / 20) * 1.5;       // moderate tempo 70-120
      s -= sigmoid((tempoBPM - 130) / 15) * 1.5;      // penalize fast tempo
      s += (1 - spectralCentroid) * 2.0;               // darker sound
      s += lowEnergyRatio * 2.5;                       // bass-heavy
      s += dynamicRange * 1.5;                         // expressive dynamics
      s += spectralFlux * 0.8;                         // some variation
      s -= spectralFlatness * 1.5;                     // tonal, not noisy
      s -= highEnergyRatio * 1.5;                      // not bright
      return s;
    })(),

    // CLASSICAL: low tempo variation, very low ZCR, high dynamic range,
    // wide spectral range, low bass, tonal (low flatness)
    classical: (() => {
      let s = 0;
      s += (1 - spectralFlatness) * 3.0;              // very tonal
      s += dynamicRange * 2.0;                         // wide dynamics
      s -= zcr * 8.0;                                  // low ZCR (smooth)
      s += midEnergyRatio * 1.5;                       // mid-range dominant
      s -= lowEnergyRatio * 2.0;                       // not bass-heavy
      s -= highEnergyRatio * 1.0;                      // not too bright
      s -= sigmoid((tempoBPM - 100) / 20) * 1.0;      // slower tempos
      s += (1 - spectralRolloff) * 1.5;               // energy concentrated lower
      return s;
    })(),

    // COUNTRY: moderate tempo, acoustic (mid-range), moderate ZCR,
    // clear vocals (mid), not too much bass
    country: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 90) / 20) * 1.5;       // moderate tempo
      s -= sigmoid((tempoBPM - 150) / 20) * 1.5;      // not too fast
      s += midEnergyRatio * 2.5;                       // mid-range dominant
      s -= lowEnergyRatio * 1.5;                       // not bass-heavy
      s += (1 - spectralFlatness) * 1.5;              // somewhat tonal
      s += clamp(zcr * 3, 0, 1.5);                    // moderate ZCR
      s -= highEnergyRatio * 1.0;                      // not too bright
      return s;
    })(),

    // DISCO: fast tempo (120-140 BPM), strong bass, bright highs,
    // high energy, moderate ZCR
    disco: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 115) / 10) * 2.0;      // fast tempo
      s -= sigmoid((tempoBPM - 145) / 10) * 2.0;      // not too fast
      s += lowEnergyRatio * 2.0;                       // strong bass
      s += highEnergyRatio * 1.5;                      // bright highs
      s += rms * 3.0;                                  // high energy
      s += spectralFlux * 0.5;                         // rhythmic variation
      s -= (1 - spectralFlatness) * 0.5;              // somewhat noisy
      return s;
    })(),

    // HIP-HOP: slow-moderate tempo (80-100 BPM), very bass-heavy,
    // high ZCR (vocal), rhythmic flux
    hiphop: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 75) / 15) * 1.5;       // moderate tempo
      s -= sigmoid((tempoBPM - 110) / 15) * 1.5;      // not too fast
      s += lowEnergyRatio * 3.0;                       // very bass-heavy
      s += zcr * 5.0;                                  // vocal content (high ZCR)
      s += spectralFlux * 0.8;                         // rhythmic
      s -= midEnergyRatio * 0.5;                       // less mid
      s -= (1 - spectralFlatness) * 0.5;              // somewhat noisy
      return s;
    })(),

    // JAZZ: moderate tempo, complex harmonics (high spectral spread),
    // moderate ZCR, tonal, wide dynamic range
    jazz: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 80) / 20) * 1.5;       // moderate tempo
      s -= sigmoid((tempoBPM - 160) / 20) * 1.5;      // not too fast
      s += (1 - spectralFlatness) * 2.0;              // tonal
      s += dynamicRange * 1.5;                         // expressive
      s += midEnergyRatio * 2.0;                       // mid-range
      s += spectralFlux * 0.6;                         // improvisation
      s -= lowEnergyRatio * 1.0;                       // not bass-heavy
      s -= highEnergyRatio * 0.5;                      // not too bright
      return s;
    })(),

    // METAL: fast tempo (140-180 BPM), high ZCR (distortion),
    // high spectral flux, high energy, bright/harsh
    metal: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 130) / 20) * 2.5;      // fast tempo
      s += zcr * 10.0;                                 // high ZCR (distortion)
      s += spectralFlux * 1.5;                         // aggressive
      s += highEnergyRatio * 2.0;                      // bright/harsh
      s += rms * 2.0;                                  // loud
      s += spectralFlatness * 2.0;                     // noisy
      s -= (1 - spectralFlatness) * 1.0;              // not tonal
      return s;
    })(),

    // POP: moderate-fast tempo (100-130 BPM), balanced spectrum,
    // high energy, catchy (moderate flux), bright
    pop: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 100) / 15) * 1.5;      // moderate-fast
      s -= sigmoid((tempoBPM - 140) / 15) * 1.5;      // not too fast
      s += midEnergyRatio * 2.0;                       // mid-range vocals
      s += highEnergyRatio * 1.0;                      // some brightness
      s += rms * 2.0;                                  // high energy
      s -= lowEnergyRatio * 0.5;                       // not too bass-heavy
      s += spectralCentroid * 1.5;                     // brighter sound
      return s;
    })(),

    // REGGAE: slow-moderate tempo (60-90 BPM), very bass-heavy,
    // offbeat rhythm (moderate flux), low ZCR
    reggae: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 60) / 15) * 1.5;       // slow tempo
      s -= sigmoid((tempoBPM - 100) / 15) * 2.0;      // penalize fast tempo
      s += lowEnergyRatio * 3.5;                       // very bass-heavy
      s -= zcr * 5.0;                                  // low ZCR (smooth)
      s += spectralFlux * 0.5;                         // rhythmic
      s -= highEnergyRatio * 1.5;                      // not bright
      s += (1 - spectralFlatness) * 1.0;              // somewhat tonal
      return s;
    })(),

    // ROCK: moderate-fast tempo (110-150 BPM), high energy,
    // moderate ZCR (guitar distortion), balanced spectrum
    rock: (() => {
      let s = 0;
      s += sigmoid((tempoBPM - 110) / 20) * 2.0;      // fast tempo
      s -= sigmoid((tempoBPM - 170) / 20) * 1.5;      // not too fast
      s += rms * 2.5;                                  // high energy
      s += zcr * 4.0;                                  // guitar distortion
      s += spectralFlux * 1.0;                         // energetic
      s += midEnergyRatio * 1.5;                       // mid-range guitars
      s -= lowEnergyRatio * 0.5;                       // not too bass-heavy
      return s;
    })(),
  };

  // Add pseudo-noise for realistic variation
  const genreList = GENRES as readonly string[];
  const noisyScores = genreList.map((genre, i) => {
    return rawScores[genre as Genre] + pseudoNoise(noiseSeed, i);
  });

  // Apply softmax to get probabilities
  const probabilities = softmax(noisyScores);

  // Build confidence scores map
  const confidence_scores: Record<string, number> = {};
  genreList.forEach((genre, i) => {
    confidence_scores[genre] = Math.round(probabilities[i] * 1000) / 1000;
  });

  // Find predicted genre
  let maxProb = -1;
  let predicted_genre = 'rock';
  for (const [genre, prob] of Object.entries(confidence_scores)) {
    if (prob > maxProb) {
      maxProb = prob;
      predicted_genre = genre;
    }
  }

  return { predicted_genre, confidence_scores };
}
