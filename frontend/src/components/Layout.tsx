import { ReactNode } from 'react';
import EqualizerBars from './EqualizerBars';
import { Music2, Heart } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown-app';
    const utmUrl = `https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(hostname)}`;

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="relative overflow-hidden border-b border-charcoal-700/50">
                {/* Hero banner background */}
                <div className="absolute inset-0">
                    <img
                        src="/assets/generated/hero-banner.dim_1200x400.png"
                        alt=""
                        className="w-full h-full object-cover opacity-20"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal-900/60 via-background/80 to-background" />
                </div>

                <div className="relative container mx-auto px-4 py-8 md:py-12">
                    <div className="flex flex-col items-center text-center gap-4">
                        {/* Logo mark */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                                <Music2 className="w-5 h-5 text-amber-500" />
                            </div>
                            <span className="font-display font-bold text-xl tracking-tight text-foreground">
                                Genre<span className="text-amber-500">AI</span>
                            </span>
                        </div>

                        {/* Equalizer decoration */}
                        <div className="flex items-end h-8 gap-0.5 opacity-60">
                            <EqualizerBars count={20} animated={true} />
                        </div>

                        <div>
                            <h1 className="font-display font-bold text-3xl md:text-4xl lg:text-5xl text-foreground tracking-tight">
                                Music Genre{' '}
                                <span className="text-amber-500 text-amber-glow">Classifier</span>
                            </h1>
                            <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
                                Upload any audio file and our AI will identify its genre with confidence scores across 10 music categories.
                            </p>
                        </div>

                        {/* Genre tags */}
                        <div className="flex flex-wrap justify-center gap-2 mt-1">
                            {['Blues', 'Classical', 'Country', 'Disco', 'Hip-Hop', 'Jazz', 'Metal', 'Pop', 'Reggae', 'Rock'].map((genre) => (
                                <span
                                    key={genre}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-charcoal-800 border border-charcoal-700 text-muted-foreground"
                                >
                                    {genre}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-3xl">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-charcoal-700/50 py-6">
                <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Music2 className="w-4 h-4 text-amber-500/60" />
                        <span>Music Genre Classifier &copy; {new Date().getFullYear()}</span>
                    </div>
                    <a
                        href={utmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                    >
                        Built with <Heart className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> using caffeine.ai
                    </a>
                </div>
            </footer>
        </div>
    );
}
