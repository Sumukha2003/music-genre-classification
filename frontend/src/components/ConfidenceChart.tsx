import { useEffect, useRef } from 'react';

interface ConfidenceChartProps {
    scores: Record<string, number>;
    predictedGenre: string;
}

const GENRE_COLORS: Record<string, string> = {
    blues:     'oklch(0.60 0.15 240)',
    classical: 'oklch(0.72 0.12 300)',
    country:   'oklch(0.75 0.14 60)',
    disco:     'oklch(0.70 0.18 320)',
    hiphop:    'oklch(0.65 0.20 30)',
    jazz:      'oklch(0.68 0.16 200)',
    metal:     'oklch(0.55 0.08 260)',
    pop:       'oklch(0.75 0.18 350)',
    reggae:    'oklch(0.72 0.18 140)',
    rock:      'oklch(0.65 0.17 25)',
};

const GENRE_ICONS: Record<string, string> = {
    blues: '🎸',
    classical: '🎻',
    country: '🤠',
    disco: '🪩',
    hiphop: '🎤',
    jazz: '🎷',
    metal: '🤘',
    pop: '🎵',
    reggae: '🌿',
    rock: '⚡',
};

function getGenreColor(genre: string): string {
    const key = genre.toLowerCase().replace(/[^a-z]/g, '');
    return GENRE_COLORS[key] || 'oklch(0.78 0.16 75)';
}

function getGenreIcon(genre: string): string {
    const key = genre.toLowerCase().replace(/[^a-z]/g, '');
    return GENRE_ICONS[key] || '🎵';
}

export default function ConfidenceChart({ scores, predictedGenre }: ConfidenceChartProps) {
    const barsRef = useRef<HTMLDivElement>(null);

    // Sort genres by confidence descending
    const sortedEntries = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const maxScore = sortedEntries[0]?.[1] ?? 1;

    useEffect(() => {
        if (!barsRef.current) return;
        const bars = barsRef.current.querySelectorAll<HTMLDivElement>('[data-bar]');
        bars.forEach((bar, i) => {
            const targetWidth = bar.getAttribute('data-target-width') || '0%';
            bar.style.width = '0%';
            bar.style.opacity = '0';
            setTimeout(() => {
                bar.style.transition = `width 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms, opacity 0.3s ease ${i * 60}ms`;
                bar.style.width = targetWidth;
                bar.style.opacity = '1';
            }, 50);
        });
    }, [scores]);

    return (
        <div ref={barsRef} className="space-y-3">
            {sortedEntries.map(([genre, score]) => {
                const isPredicted = genre.toLowerCase() === predictedGenre.toLowerCase();
                const pct = Math.round(score * 100);
                const barWidth = `${(score / maxScore) * 100}%`;
                const color = getGenreColor(genre);
                const icon = getGenreIcon(genre);

                return (
                    <div
                        key={genre}
                        className={[
                            'group relative rounded-xl p-3 transition-colors',
                            isPredicted ? 'bg-amber-500/8 border border-amber-500/20' : 'bg-charcoal-800/60 border border-charcoal-700/50',
                        ].join(' ')}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base leading-none">{icon}</span>
                                <span className={[
                                    'text-sm font-semibold capitalize',
                                    isPredicted ? 'text-amber-400' : 'text-foreground/80'
                                ].join(' ')}>
                                    {genre}
                                </span>
                                {isPredicted && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                                        Top
                                    </span>
                                )}
                            </div>
                            <span className={[
                                'text-sm font-bold tabular-nums',
                                isPredicted ? 'text-amber-400' : 'text-muted-foreground'
                            ].join(' ')}>
                                {pct}%
                            </span>
                        </div>

                        {/* Bar track */}
                        <div className="h-2 rounded-full bg-charcoal-700 overflow-hidden">
                            <div
                                data-bar
                                data-target-width={barWidth}
                                className="h-full rounded-full"
                                style={{
                                    width: '0%',
                                    opacity: 0,
                                    background: isPredicted
                                        ? 'linear-gradient(90deg, oklch(0.78 0.16 75), oklch(0.72 0.17 70))'
                                        : color,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
