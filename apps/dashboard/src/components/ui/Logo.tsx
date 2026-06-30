type LogoProps = {
    size?: number;
    showText?: boolean;
};

export default function Logo({
    size = 42,
    showText = true,
}: LogoProps) {
    return (
        <div className="flex items-center gap-3">
            <div
                style={{
                    width: size,
                    height: size,
                }}
                className="rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg"
            >
                R
            </div>

            {showText && (
                <div>
                    <h2 className="font-bold text-xl text-slate-900">
                        Restroex
                    </h2>

                    <p className="text-xs text-slate-500">
                        AI Restaurant OS
                    </p>
                </div>
            )}
        </div>
    );
}