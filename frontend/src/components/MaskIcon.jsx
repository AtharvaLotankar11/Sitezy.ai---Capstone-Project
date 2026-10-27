// Renders a PNG icon as a single solid color using CSS masking — so one icon asset
// can be tinted to any color (e.g. the web-design icon recolored per template,
// or the dashboard icons matched to their stat colors).
export default function MaskIcon({ src, color = "currentColor", size = 22, style = {} }) {
    return (
        <span
            aria-hidden="true"
            style={{
                display: "inline-block",
                width: size,
                height: size,
                backgroundColor: color,
                WebkitMaskImage: `url(${src})`,
                maskImage: `url(${src})`,
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                ...style,
            }}
        />
    );
}
