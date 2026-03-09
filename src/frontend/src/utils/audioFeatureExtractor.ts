/**
 * Client-side audio feature extraction using the Web Audio API.
 * Extracts spectral, temporal, and timbral features (including MFCCs)
 * from an audio file for improved genre classification accuracy.
 */

export interface AudioFeatures {
  /** Root Mean Square energy (loudness) */
  rms: number;
  /** Zero Crossing Rate (noisiness / high-frequency content) */
  zcr: number;
  /** Spectral centroid (brightness) normalized 0-1 */
  spectralCentroid: number;
  /** Spectral rolloff (frequency below which 85% of energy lies) normalized 0-1 */
  spectralRolloff: number;
  /** Spectral flux (rate of change of spectrum) */
  spectralFlux: number;
  /** Sub-bass energy ratio (20-80 Hz) */
  subBassRatio: number;
  /** Bass energy ratio (80-300 Hz) */
  lowEnergyRatio: number;
  /** Low-mid energy ratio (300-1000 Hz) */
  lowMidRatio: number;
  /** Mid energy ratio (1000-3000 Hz) */
  midEnergyRatio: number;
  /** High-mid energy ratio (3000-6000 Hz) */
  highMidRatio: number;
  /** Presence/air energy ratio (6000+ Hz) */
  highEnergyRatio: number;
  /** Estimated tempo in BPM */
  tempoBPM: number;
  /** Dynamic range (max amplitude) */
  dynamicRange: number;
  /** Spectral flatness (tonal vs noisy) */
  spectralFlatness: number;
  /** Spectral bandwidth (spread around centroid) normalized 0-1 */
  spectralBandwidth: number;
  /** Spectral contrast (difference between peaks and valleys) */
  spectralContrast: number;
  /** Harmonic-to-noise ratio proxy */
  harmonicRatio: number;
  /** First 13 MFCC coefficients */
  mfcc: number[];
  /** Rhythm regularity (how steady the beat is) 0-1 */
  rhythmRegularity: number;
  /** Sample rate of the decoded audio */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
}

// ---------------------------------------------------------------------------
// DSP helpers
// ---------------------------------------------------------------------------

/** Radix-2 Cooley-Tukey FFT (in-place, power-of-2 size) */
function fft(re: Float64Array, im: Float64Array): void {
  const N = re.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // FFT butterfly
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const ang = (2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = -Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + halfLen] * curRe - im[i + k + halfLen] * curIm;
        const vIm = re[i + k + halfLen] * curIm + im[i + k + halfLen] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + halfLen] = uRe - vRe;
        im[i + k + halfLen] = uIm - vIm;
        const newRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newRe;
      }
    }
  }
}

/** Compute magnitude spectrum from a PCM frame (applies Hann window internally) */
function computeMagnitudeSpectrum(frame: Float32Array): Float64Array {
  const N = frame.length;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    re[i] = frame[i] * window;
  }
  fft(re, im);
  const half = N >> 1;
  const mag = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N;
  }
  return mag;
}

/** Compute RMS energy */
function computeRMS(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/** Zero Crossing Rate */
function computeZCR(frame: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if (frame[i] >= 0 !== frame[i - 1] >= 0) crossings++;
  }
  return crossings / frame.length;
}

/** Spectral centroid in Hz */
function computeSpectralCentroid(
  mag: Float64Array,
  sampleRate: number,
): number {
  const N = mag.length;
  let weightedSum = 0;
  let totalMag = 0;
  for (let k = 0; k < N; k++) {
    const freq = (k * sampleRate) / (2 * N);
    weightedSum += freq * mag[k];
    totalMag += mag[k];
  }
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

/** Spectral bandwidth (weighted std around centroid) */
function computeSpectralBandwidth(
  mag: Float64Array,
  sampleRate: number,
  centroid: number,
): number {
  const N = mag.length;
  let weightedVar = 0;
  let totalMag = 0;
  for (let k = 0; k < N; k++) {
    const freq = (k * sampleRate) / (2 * N);
    const diff = freq - centroid;
    weightedVar += diff * diff * mag[k];
    totalMag += mag[k];
  }
  return totalMag > 0 ? Math.sqrt(weightedVar / totalMag) : 0;
}

/** Spectral rolloff frequency */
function computeSpectralRolloff(
  mag: Float64Array,
  sampleRate: number,
  rolloffPct = 0.85,
): number {
  const N = mag.length;
  let totalEnergy = 0;
  for (let k = 0; k < N; k++) totalEnergy += mag[k] * mag[k];
  const threshold = totalEnergy * rolloffPct;
  let cum = 0;
  for (let k = 0; k < N; k++) {
    cum += mag[k] * mag[k];
    if (cum >= threshold) return (k * sampleRate) / (2 * N);
  }
  return sampleRate / 2;
}

/** Spectral flatness (Wiener entropy) */
function computeSpectralFlatness(mag: Float64Array): number {
  let logSum = 0;
  let arithmeticSum = 0;
  let count = 0;
  for (let k = 0; k < mag.length; k++) {
    if (mag[k] > 1e-10) {
      logSum += Math.log(mag[k]);
      arithmeticSum += mag[k];
      count++;
    }
  }
  if (count === 0 || arithmeticSum === 0) return 0;
  const gm = Math.exp(logSum / count);
  const am = arithmeticSum / count;
  return gm / am;
}

/** Spectral contrast: avg difference between local peaks and valleys in 6 sub-bands */
function computeSpectralContrast(
  mag: Float64Array,
  sampleRate: number,
): number {
  const bandEdgesHz = [0, 200, 500, 1250, 3200, 8000, sampleRate / 2];
  const N = mag.length;
  const binWidth = sampleRate / 2 / N;
  let totalContrast = 0;
  let bandCount = 0;

  for (let b = 0; b < bandEdgesHz.length - 1; b++) {
    const kLow = Math.floor(bandEdgesHz[b] / binWidth);
    const kHigh = Math.min(N - 1, Math.floor(bandEdgesHz[b + 1] / binWidth));
    if (kHigh <= kLow) continue;

    const vals: number[] = [];
    for (let k = kLow; k <= kHigh; k++) vals.push(mag[k]);
    vals.sort((a, b) => a - b);

    const n = vals.length;
    const topN = Math.max(1, Math.floor(n * 0.2));
    const botN = Math.max(1, Math.floor(n * 0.2));
    const topMean = vals.slice(-topN).reduce((a, v) => a + v, 0) / topN;
    const botMean = vals.slice(0, botN).reduce((a, v) => a + v, 0) / botN;
    if (botMean > 1e-10) {
      totalContrast += Math.log(topMean / botMean + 1e-10);
      bandCount++;
    }
  }
  return bandCount > 0 ? totalContrast / bandCount : 0;
}

// ---------------------------------------------------------------------------
// Mel filterbank & MFCCs
// ---------------------------------------------------------------------------

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

/**
 * Build a mel filterbank matrix (numFilters x halfFFT).
 */
function buildMelFilterbank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
): number[][] {
  const half = fftSize >> 1;
  const nyquist = sampleRate / 2;
  const melMin = hzToMel(20);
  const melMax = hzToMel(nyquist);

  // Mel-spaced center frequencies
  const melPoints = new Float64Array(numFilters + 2);
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = melMin + (i * (melMax - melMin)) / (numFilters + 1);
  }
  const hzPoints = Array.from(melPoints, (mel) => melToHz(mel));
  const binPoints = hzPoints.map((hz) =>
    Math.floor((hz / nyquist) * (half - 1)),
  );

  const filterbank: number[][] = [];
  for (let m = 1; m <= numFilters; m++) {
    const filter = new Array(half).fill(0);
    for (let k = binPoints[m - 1]; k <= binPoints[m]; k++) {
      filter[k] =
        (k - binPoints[m - 1]) / (binPoints[m] - binPoints[m - 1] + 1e-10);
    }
    for (let k = binPoints[m]; k <= binPoints[m + 1]; k++) {
      filter[k] =
        (binPoints[m + 1] - k) / (binPoints[m + 1] - binPoints[m] + 1e-10);
    }
    filterbank.push(filter);
  }
  return filterbank;
}

/**
 * Compute MFCCs from magnitude spectrum using DCT-II.
 */
function computeMFCC(
  mag: Float64Array,
  filterbank: number[][],
  numCoeffs: number,
): number[] {
  const numFilters = filterbank.length;

  // Apply mel filterbank and log
  const logEnergies = new Float64Array(numFilters);
  for (let m = 0; m < numFilters; m++) {
    let energy = 0;
    for (let k = 0; k < mag.length; k++) {
      energy += filterbank[m][k] * mag[k] * mag[k];
    }
    logEnergies[m] = Math.log(Math.max(energy, 1e-10));
  }

  // DCT-II to get cepstral coefficients
  const mfcc: number[] = [];
  for (let n = 0; n < numCoeffs; n++) {
    let sum = 0;
    for (let m = 0; m < numFilters; m++) {
      sum += logEnergies[m] * Math.cos((Math.PI * n * (m + 0.5)) / numFilters);
    }
    mfcc.push(sum);
  }
  return mfcc;
}

// ---------------------------------------------------------------------------
// Tempo & rhythm
// ---------------------------------------------------------------------------

/** Estimate tempo using onset-strength autocorrelation */
function estimateTempo(
  rmsEnvelope: number[],
  sampleRate: number,
  hopSize: number,
): {
  bpm: number;
  regularity: number;
} {
  const N = rmsEnvelope.length;
  if (N < 20) return { bpm: 120, regularity: 0.5 };

  // Compute first-order difference (onset strength)
  const onset: number[] = [];
  for (let i = 1; i < N; i++) {
    onset.push(Math.max(0, rmsEnvelope[i] - rmsEnvelope[i - 1]));
  }

  // Autocorrelation over a range spanning 50-210 BPM
  const secPerFrame = hopSize / sampleRate;
  const lagMin = Math.max(1, Math.round(60 / 210 / secPerFrame));
  const lagMax = Math.min(onset.length - 1, Math.round(60 / 50 / secPerFrame));

  let bestLag = lagMin;
  let bestCorr = Number.NEGATIVE_INFINITY;
  const corrValues: number[] = [];

  for (let lag = lagMin; lag <= lagMax; lag++) {
    let corr = 0;
    for (let i = 0; i < onset.length - lag; i++) {
      corr += onset[i] * onset[i + lag];
    }
    corr /= onset.length - lag;
    corrValues.push(corr);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Rhythm regularity: ratio of best peak to mean correlation
  const meanCorr = corrValues.reduce((a, b) => a + b, 0) / corrValues.length;
  const regularity =
    meanCorr > 0 ? Math.min(1, bestCorr / (meanCorr * 3)) : 0.5;

  const bpm = 60 / (bestLag * secPerFrame);
  return { bpm: Math.max(50, Math.min(210, bpm)), regularity };
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract comprehensive audio features from a File using the Web Audio API.
 * Analyzes up to 30 seconds; returns a rich feature vector for genre classification.
 */
export async function extractAudioFeatures(file: File): Promise<AudioFeatures> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }

  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // Mono mix-down
  let channelData: Float32Array;
  if (audioBuffer.numberOfChannels >= 2) {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    channelData = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) channelData[i] = (ch0[i] + ch1[i]) / 2;
  } else {
    channelData = audioBuffer.getChannelData(0);
  }

  // Limit to 30 s
  const maxSamples = Math.min(channelData.length, sampleRate * 30);
  const samples = channelData.slice(0, maxSamples);

  // Frame parameters (2048-pt FFT for better frequency resolution)
  const frameSize = 2048;
  const hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);

  const defaultFeatures: AudioFeatures = {
    rms: 0,
    zcr: 0,
    spectralCentroid: 0.5,
    spectralRolloff: 0.5,
    spectralFlux: 0,
    subBassRatio: 0.1,
    lowEnergyRatio: 0.2,
    lowMidRatio: 0.2,
    midEnergyRatio: 0.2,
    highMidRatio: 0.2,
    highEnergyRatio: 0.1,
    tempoBPM: 120,
    dynamicRange: 0,
    spectralFlatness: 0.5,
    spectralBandwidth: 0.5,
    spectralContrast: 1,
    harmonicRatio: 0.5,
    mfcc: new Array(13).fill(0),
    rhythmRegularity: 0.5,
    sampleRate,
    duration,
  };

  if (numFrames <= 0) return defaultFeatures;

  // Build mel filterbank once
  const NUM_MEL_FILTERS = 26;
  const NUM_MFCC = 13;
  const melFilterbank = buildMelFilterbank(
    NUM_MEL_FILTERS,
    frameSize,
    sampleRate,
  );

  // Accumulators
  let totalRMS = 0;
  let totalZCR = 0;
  let totalCentroid = 0;
  let totalRolloff = 0;
  let totalFlatness = 0;
  let totalBandwidth = 0;
  let totalContrast = 0;
  let totalSubBass = 0;
  let totalLow = 0;
  let totalLowMid = 0;
  let totalMid = 0;
  let totalHighMid = 0;
  let totalHigh = 0;
  let totalFlux = 0;
  const mfccAccum = new Array(NUM_MFCC).fill(0);
  let prevMag: Float64Array | null = null;
  const rmsEnvelope: number[] = [];

  // Process every N-th frame to stay within ~200 processed frames
  const step = Math.max(1, Math.floor(numFrames / 200));
  let processedFrames = 0;

  const nyquist = sampleRate / 2;
  const binWidth = nyquist / (frameSize >> 1);

  for (let f = 0; f < numFrames; f += step) {
    const start = f * hopSize;
    const frame = samples.slice(start, start + frameSize);

    const rms = computeRMS(frame);
    const zcr = computeZCR(frame);
    rmsEnvelope.push(rms);

    const mag = computeMagnitudeSpectrum(frame);
    const centroid = computeSpectralCentroid(mag, sampleRate);
    const rolloff = computeSpectralRolloff(mag, sampleRate);
    const flatness = computeSpectralFlatness(mag);
    const bandwidth = computeSpectralBandwidth(mag, sampleRate, centroid);
    const contrast = computeSpectralContrast(mag, sampleRate);

    // 6-band energy ratios (sub-bass / bass / low-mid / mid / high-mid / high)
    let subBassE = 0;
    let lowE = 0;
    let lowMidE = 0;
    let midE = 0;
    let highMidE = 0;
    let highE = 0;
    let totalE = 0;
    for (let k = 0; k < mag.length; k++) {
      const freq = k * binWidth;
      const e = mag[k] * mag[k];
      totalE += e;
      if (freq < 80) subBassE += e;
      else if (freq < 300) lowE += e;
      else if (freq < 1000) lowMidE += e;
      else if (freq < 3000) midE += e;
      else if (freq < 6000) highMidE += e;
      else highE += e;
    }
    if (totalE > 0) {
      totalSubBass += subBassE / totalE;
      totalLow += lowE / totalE;
      totalLowMid += lowMidE / totalE;
      totalMid += midE / totalE;
      totalHighMid += highMidE / totalE;
      totalHigh += highE / totalE;
    }

    // Spectral flux
    if (prevMag) {
      let flux = 0;
      for (let k = 0; k < mag.length; k++) {
        const diff = mag[k] - prevMag[k];
        flux += diff * diff;
      }
      totalFlux += Math.sqrt(flux) / mag.length;
    }
    prevMag = mag;

    // MFCCs
    const coeffs = computeMFCC(mag, melFilterbank, NUM_MFCC);
    for (let n = 0; n < NUM_MFCC; n++) mfccAccum[n] += coeffs[n];

    totalRMS += rms;
    totalZCR += zcr;
    totalCentroid += centroid;
    totalRolloff += rolloff;
    totalFlatness += flatness;
    totalBandwidth += bandwidth;
    totalContrast += contrast;
    processedFrames++;
  }

  const pf = processedFrames;
  const avgRMS = totalRMS / pf;
  const avgZCR = totalZCR / pf;
  const avgCentroid = totalCentroid / pf;
  const avgRolloff = totalRolloff / pf;
  const avgFlatness = totalFlatness / pf;
  const avgBandwidth = totalBandwidth / pf;
  const avgContrast = totalContrast / pf;
  const avgSubBass = totalSubBass / pf;
  const avgLow = totalLow / pf;
  const avgLowMid = totalLowMid / pf;
  const avgMid = totalMid / pf;
  const avgHighMid = totalHighMid / pf;
  const avgHigh = totalHigh / pf;
  const avgFlux = pf > 1 ? totalFlux / (pf - 1) : 0;
  const avgMFCC = mfccAccum.map((v) => v / pf);

  // Dynamic range
  let maxAmp = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAmp) maxAmp = abs;
  }

  // Tempo + rhythm regularity
  const { bpm, regularity } = estimateTempo(rmsEnvelope, sampleRate, hopSize);

  // Harmonic ratio: inverse of flatness (tonal content proxy)
  const harmonicRatio = 1 - avgFlatness;

  return {
    rms: avgRMS,
    zcr: avgZCR,
    spectralCentroid: Math.min(1, avgCentroid / nyquist),
    spectralRolloff: Math.min(1, avgRolloff / nyquist),
    spectralFlux: avgFlux,
    subBassRatio: avgSubBass,
    lowEnergyRatio: avgLow,
    lowMidRatio: avgLowMid,
    midEnergyRatio: avgMid,
    highMidRatio: avgHighMid,
    highEnergyRatio: avgHigh,
    tempoBPM: bpm,
    dynamicRange: maxAmp,
    spectralFlatness: avgFlatness,
    spectralBandwidth: Math.min(1, avgBandwidth / nyquist),
    spectralContrast: avgContrast,
    harmonicRatio,
    mfcc: avgMFCC,
    rhythmRegularity: regularity,
    sampleRate,
    duration,
  };
}
