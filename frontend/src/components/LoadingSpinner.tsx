interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

export default function LoadingSpinner({ size = 'md', label = 'Analyzing audio...' }: LoadingSpinnerProps) {
    const sizeMap = {
        sm: 'w-5 h-5',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-8">
            {/* Animated equalizer bars */}
            <div className="flex items-end gap-1 h-10">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className={`w-2 rounded-full bg-amber-500 eq-bar-${i}`}
                        style={{ height: '16px' }}
                    />
                ))}
            </div>

            {/* Spinner ring */}
            <div className={`relative ${sizeMap[size]}`}>
                <div className="absolute inset-0 rounded-full border-2 border-charcoal-700" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" />
            </div>

            {label && (
                <div className="text-center">
                    <p className="text-sm font-medium text-amber-400">{label}</p>
                    <p className="text-xs text-muted-foreground mt-1">Extracting audio features...</p>
                </div>
            )}
        </div>
    );
}
