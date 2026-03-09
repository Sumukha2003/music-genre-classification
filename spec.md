# Specification

## Summary
**Goal:** Replace the backend-dependent genre classification in GenreClassifier.tsx with a fully client-side pipeline using the Web Audio API and TensorFlow.js, so no server or canister calls are needed for audio analysis.

**Planned changes:**
- Remove the `useActor` hook usage from `GenreClassifier.tsx` so no ICP backend canister is invoked during classification.
- Add client-side audio decoding and feature extraction (MFCC and spectral features) using the Web Audio API (`AudioContext`) directly in the browser.
- Load a pre-trained GTZAN-style genre classification TensorFlow.js model from a public CDN or bundled weights and run inference client-side.
- Display the predicted genre label and per-genre confidence scores using the existing `ConfidenceChart` animated bars UI, driven by the client-side inference result.
- Preserve the existing loading state, visual theme, `EqualizerBars`, and `Layout` components.

**User-visible outcome:** Users can upload an MP3, WAV, or OGG file and instantly see the predicted genre and confidence scores for all genres — entirely in the browser with no backend or network calls for prediction.
