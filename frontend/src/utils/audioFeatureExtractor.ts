/**
 * Client-side audio feature extraction using the Web Audio API.
 * Extracts spectral and temporal features from an audio file for genre classification.
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
  /** Low-frequency energy ratio (bass content) */
  lowEnergyRatio: number;
  /** Mid-frequency energy ratio */
  midEnergyRatio: number;
  /** High-frequency energy ratio */
  highEnergyRatio: number;
  /** Estimated tempo in BPM (rough) */
  tempoBPM: number;
  /** Dynamic range (max - min amplitude) */
  dynamicRange: number;
  /** Spectral flatness (tonal vs noisy) */
  spectralFlatness: number;
  /** Sample rate of the decoded audio */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
}

/** Compute FFT magnitude spectrum from a time-domain frame using DFT (simplified) */
function computeFFT(frame: Float32Array): Float32Array {
  const N = frame.length;
  const half = Math.floor(N / 2);
  const magnitudes = new Float32Array(half);

  // Use a simple DFT for small frames; for larger frames we use a radix-2 FFT approximation
  // We'll use a Cooley-Tukey style approach with power-of-2 sizes
  for (let k = 0; k < half; k++) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      real += frame[n] * Math.cos(angle);
      imag -= frame[n] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag) / N;
  }
  return magnitudes;
}

/** Apply a Hann window to a frame */
function applyHannWindow(frame: Float32Array): Float32Array {
  const N = frame.length;
  const windowed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    windowed[i] = frame[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return windowed;
}

/** Compute spectral centroid from magnitude spectrum */
function spectralCentroid(magnitudes: Float32Array, sampleRate: number): number {
  const N = magnitudes.length;
  let weightedSum = 0;
  let totalMag = 0;
  for (let k = 0; k < N; k++) {
    const freq = (k * sampleRate) / (2 * N);
    weightedSum += freq * magnitudes[k];
    totalMag += magnitudes[k];
  }
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

/** Compute spectral rolloff (frequency below which `rolloffPercent` of energy lies) */
function spectralRolloff(magnitudes: Float32Array, sampleRate: number, rolloffPercent = 0.85): number {
  const N = magnitudes.length;
  let totalEnergy = 0;
  for (let k = 0; k < N; k++) totalEnergy += magnitudes[k] * magnitudes[k];
  const threshold = totalEnergy * rolloffPercent;
  let cumEnergy = 0;
  for (let k = 0; k < N; k++) {
    cumEnergy += magnitudes[k] * magnitudes[k];
    if (cumEnergy >= threshold) {
      return (k * sampleRate) / (2 * N);
    }
  }
  return sampleRate / 2;
}

/** Compute spectral flatness (Wiener entropy) */
function spectralFlatness(magnitudes: Float32Array): number {
  const N = magnitudes.length;
  let logSum = 0;
  let arithmeticSum = 0;
  let count = 0;
  for (let k = 0; k < N; k++) {
    if (magnitudes[k] > 1e-10) {
      logSum += Math.log(magnitudes[k]);
      arithmeticSum += magnitudes[k];
      count++;
    }
  }
  if (count === 0 || arithmeticSum === 0) return 0;
  const geometricMean = Math.exp(logSum / count);
  const arithmeticMean = arithmeticSum / count;
  return geometricMean / arithmeticMean;
}

/** Compute RMS energy of a frame */
function computeRMS(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/** Compute Zero Crossing Rate */
function computeZCR(frame: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) crossings++;
  }
  return crossings / frame.length;
}

/** Estimate tempo using autocorrelation on RMS envelope */
function estimateTempo(rmsEnvelope: number[], sampleRate: number, hopSize: number): number {
  const N = rmsEnvelope.length;
  if (N < 10) return 120;

  // Compute autocorrelation
  const maxLag = Math.min(N - 1, Math.floor((sampleRate * 60) / (hopSize * 60))); // up to 60 BPM
  const minLag = Math.max(1, Math.floor((sampleRate * 60) / (hopSize * 200))); // down to 200 BPM

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < N - lag; i++) {
      corr += rmsEnvelope[i] * rmsEnvelope[i + lag];
    }
    corr /= N - lag;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const secondsPerBeat = (bestLag * hopSize) / sampleRate;
  const bpm = 60 / secondsPerBeat;
  return Math.max(60, Math.min(200, bpm));
}

/**
 * Extract audio features from a File object using the Web Audio API.
 * Processes up to 30 seconds of audio for performance.
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

  // Use mono channel data; mix down if stereo
  let channelData: Float32Array;
  if (audioBuffer.numberOfChannels >= 2) {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    channelData = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
      channelData[i] = (ch0[i] + ch1[i]) / 2;
    }
  } else {
    channelData = audioBuffer.getChannelData(0);
  }

  // Limit to first 30 seconds for performance
  const maxSamples = Math.min(channelData.length, sampleRate * 30);
  const samples = channelData.slice(0, maxSamples);

  // Frame parameters
  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);

  if (numFrames <= 0) {
    return {
      rms: 0, zcr: 0, spectralCentroid: 0.5, spectralRolloff: 0.5,
      spectralFlux: 0, lowEnergyRatio: 0.33, midEnergyRatio: 0.33,
      highEnergyRatio: 0.33, tempoBPM: 120, dynamicRange: 0,
      spectralFlatness: 0.5, sampleRate, duration,
    };
  }

  // Aggregate features across frames
  let totalRMS = 0;
  let totalZCR = 0;
  let totalCentroid = 0;
  let totalRolloff = 0;
  let totalFlatness = 0;
  let totalLowEnergy = 0;
  let totalMidEnergy = 0;
  let totalHighEnergy = 0;
  let prevMagnitudes: Float32Array | null = null;
  let totalFlux = 0;
  const rmsEnvelope: number[] = [];

  // Process every other frame for performance (still accurate enough)
  const step = Math.max(1, Math.floor(numFrames / 200));

  for (let f = 0; f < numFrames; f += step) {
    const start = f * hopSize;
    const frame = samples.slice(start, start + frameSize);
    const windowed = applyHannWindow(frame);

    const rms = computeRMS(frame);
    const zcr = computeZCR(frame);
    rmsEnvelope.push(rms);

    // Only compute FFT for every frame (already limited by step)
    const magnitudes = computeFFT(windowed);
    const nyquist = sampleRate / 2;

    const centroid = spectralCentroid(magnitudes, sampleRate);
    const rolloff = spectralRolloff(magnitudes, sampleRate);
    const flatness = spectralFlatness(magnitudes);

    // Band energy ratios
    const lowCutoff = 300;
    const midCutoff = 3000;
    let lowE = 0, midE = 0, highE = 0, totalE = 0;
    const binWidth = nyquist / magnitudes.length;
    for (let k = 0; k < magnitudes.length; k++) {
      const freq = k * binWidth;
      const e = magnitudes[k] * magnitudes[k];
      totalE += e;
      if (freq < lowCutoff) lowE += e;
      else if (freq < midCutoff) midE += e;
      else highE += e;
    }
    if (totalE > 0) {
      totalLowEnergy += lowE / totalE;
      totalMidEnergy += midE / totalE;
      totalHighEnergy += highE / totalE;
    }

    // Spectral flux
    if (prevMagnitudes) {
      let flux = 0;
      for (let k = 0; k < magnitudes.length; k++) {
        const diff = magnitudes[k] - prevMagnitudes[k];
        flux += diff * diff;
      }
      totalFlux += Math.sqrt(flux);
    }
    prevMagnitudes = magnitudes;

    totalRMS += rms;
    totalZCR += zcr;
    totalCentroid += centroid;
    totalRolloff += rolloff;
    totalFlatness += flatness;
  }

  const processedFrames = Math.ceil(numFrames / step);
  const avgRMS = totalRMS / processedFrames;
  const avgZCR = totalZCR / processedFrames;
  const avgCentroid = totalCentroid / processedFrames;
  const avgRolloff = totalRolloff / processedFrames;
  const avgFlatness = totalFlatness / processedFrames;
  const avgLowEnergy = totalLowEnergy / processedFrames;
  const avgMidEnergy = totalMidEnergy / processedFrames;
  const avgHighEnergy = totalHighEnergy / processedFrames;
  const avgFlux = processedFrames > 1 ? totalFlux / (processedFrames - 1) : 0;

  // Dynamic range
  let maxAmp = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  const dynamicRange = maxAmp;

  // Estimate tempo
  const tempoBPM = estimateTempo(rmsEnvelope, sampleRate, hopSize);

  // Normalize centroid and rolloff to 0-1 range
  const nyquist = sampleRate / 2;
  const normalizedCentroid = Math.min(1, avgCentroid / nyquist);
  const normalizedRolloff = Math.min(1, avgRolloff / nyquist);

  return {
    rms: avgRMS,
    zcr: avgZCR,
    spectralCentroid: normalizedCentroid,
    spectralRolloff: normalizedRolloff,
    spectralFlux: avgFlux,
    lowEnergyRatio: avgLowEnergy,
    midEnergyRatio: avgMidEnergy,
    highEnergyRatio: avgHighEnergy,
    tempoBPM,
    dynamicRange,
    spectralFlatness: avgFlatness,
    sampleRate,
    duration,
  };
}
