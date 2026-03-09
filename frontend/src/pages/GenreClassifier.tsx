import { useState, useCallback } from 'react';
import { Music, AlertCircle, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';
import AudioUploader from '../components/AudioUploader';
import ConfidenceChart from '../components/ConfidenceChart';
import LoadingSpinner from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { extractAudioFeatures } from '../utils/audioFeatureExtractor';
import { classifyGenre } from '../utils/genreClassifier';

interface PredictionResult {
  predicted_genre: string;
  confidence_scores: Record<string, number>;
}

type AppState = 'idle' | 'loading' | 'success' | 'error';

const GENRE_DESCRIPTIONS: Record<string, string> = {
  blues: 'Soulful melodies with expressive guitar and vocal improvisation.',
  classical: 'Orchestral compositions with complex harmonic structures.',
  country: 'Storytelling lyrics with acoustic guitar and twangy vocals.',
  disco: 'Upbeat dance music with funky basslines and four-on-the-floor beats.',
  hiphop: 'Rhythmic vocal delivery over sampled beats and bass-heavy production.',
  jazz: 'Improvised harmonies with syncopated rhythms and brass instruments.',
  metal: 'Heavy distorted guitars, aggressive drumming, and powerful vocals.',
  pop: 'Catchy hooks, polished production, and broad mainstream appeal.',
  reggae: 'Offbeat rhythms, bass-heavy grooves, and laid-back vocal style.',
  rock: 'Electric guitar-driven sound with strong rhythmic backbone.',
};

function getGenreDescription(genre: string): string {
  const key = genre.toLowerCase().replace(/[^a-z]/g, '');
  return GENRE_DESCRIPTIONS[key] || 'A unique blend of musical elements and styles.';
}

function GenreResultCard({ result }: { result: PredictionResult }) {
  const genre = result.predicted_genre;
  const topScore = result.confidence_scores[genre] ?? 0;
  const pct = Math.round(topScore * 100);

  return (
    <div className="animate-slide-up space-y-6">
      {/* Top result */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-charcoal-800 to-charcoal-900 p-6 card-glow">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-500/80 uppercase tracking-widest">
                Predicted Genre
              </span>
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-amber-400 capitalize text-amber-glow mt-2">
              {genre}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              {getGenreDescription(genre)}
            </p>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="text-3xl font-bold font-display text-amber-400 tabular-nums">
              {pct}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">confidence</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-4 h-1.5 rounded-full bg-charcoal-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* All scores */}
      <div>
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          All Genre Scores
        </h3>
        <ConfidenceChart
          scores={result.confidence_scores}
          predictedGenre={genre}
        />
      </div>
    </div>
  );
}

export default function GenreClassifier() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [appState, setAppState] = useState<AppState>('idle');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setResult(null);
    setErrorMessage('');
    setAppState('idle');
  }, []);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setResult(null);
    setErrorMessage('');
    setAppState('idle');
  }, []);

  const handlePredict = useCallback(async () => {
    if (!selectedFile) return;

    setAppState('loading');
    setResult(null);
    setErrorMessage('');

    try {
      // Extract audio features client-side using Web Audio API
      const features = await extractAudioFeatures(selectedFile);

      // Classify genre using client-side rule-based model
      const prediction = classifyGenre(features);

      setResult(prediction);
      setAppState('success');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while analyzing the audio.';
      setErrorMessage(message);
      setAppState('error');
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setResult(null);
    setErrorMessage('');
    setAppState('idle');
  }, []);

  const isLoading = appState === 'loading';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Upload card */}
        <div className="rounded-2xl border border-charcoal-700 bg-card p-6 card-dark shadow-card-dark">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Music className="w-4 h-4 text-amber-500" />
            </div>
            <h2 className="font-display font-semibold text-base text-foreground">
              Upload Audio File
            </h2>
          </div>

          <AudioUploader
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClear={handleClear}
            disabled={isLoading}
          />

          {/* Action buttons */}
          <div className="mt-5 flex items-center gap-3">
            <Button
              onClick={handlePredict}
              disabled={!selectedFile || isLoading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-charcoal-950 font-semibold h-11 rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-charcoal-900/30 border-t-charcoal-900 animate-spin" />
                  Analyzing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Classify Genre
                </span>
              )}
            </Button>

            {(result || errorMessage) && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isLoading}
                className="h-11 rounded-xl border-charcoal-600 hover:border-amber-500/50 hover:bg-amber-500/5"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="rounded-2xl border border-charcoal-700 bg-card p-6 animate-fade-in">
            <LoadingSpinner label="Analyzing audio..." />
          </div>
        )}

        {/* Error state */}
        {appState === 'error' && errorMessage && (
          <Alert
            variant="destructive"
            className="rounded-2xl border-destructive/30 bg-destructive/10 animate-fade-in"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Classification Failed</AlertTitle>
            <AlertDescription className="mt-1">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {appState === 'success' && result && (
          <div className="rounded-2xl border border-charcoal-700 bg-card p-6 card-dark shadow-card-dark">
            <GenreResultCard result={result} />
          </div>
        )}

        {/* How it works */}
        {appState === 'idle' && !selectedFile && (
          <div className="rounded-2xl border border-charcoal-700/50 bg-charcoal-800/30 p-6 animate-fade-in">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-4">
              How It Works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  step: '01',
                  title: 'Upload Audio',
                  desc: 'Select an MP3, WAV, or OGG file from your device.',
                  icon: '🎵',
                },
                {
                  step: '02',
                  title: 'Feature Extraction',
                  desc: 'Spectral centroid, ZCR, energy bands, tempo and more are extracted in your browser.',
                  icon: '🔬',
                },
                {
                  step: '03',
                  title: 'Genre Prediction',
                  desc: 'Audio features are classified across 10 genre categories — entirely client-side.',
                  icon: '🎯',
                },
              ].map(({ step, title, desc, icon }) => (
                <div
                  key={step}
                  className="flex flex-col gap-2 p-4 rounded-xl bg-charcoal-800/60 border border-charcoal-700/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <span className="text-xs font-bold text-amber-500/60 font-mono">{step}</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
