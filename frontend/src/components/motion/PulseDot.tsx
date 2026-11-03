interface Props {
    color?: string;
    size?: string;
}

export function PulseDot({
    color = "bg-primary",
    size = "w-2 h-2",
}: Props) {
    return (
        <span className="relative flex">
            <span
                className={`animate-ping absolute inline-flex ${size} rounded-full ${color} opacity-60`}
            />
            <span className={`relative inline-flex ${size} rounded-full ${color}`} />
        </span>
    );
}