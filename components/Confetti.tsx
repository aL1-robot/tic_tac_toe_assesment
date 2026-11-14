const COLORS = ["#3a2a1f", "#1f6585", "#e4d3ab", "#eef3f0", "#2f9aa8", "#c9a45c"];

export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 48 }, (_, index) => (
        <i
          key={index}
          style={{
            left: `${(index * 47 + 13) % 100}%`,
            background: COLORS[index % COLORS.length],
            animationDuration: `${2.2 + ((index * 17) % 22) / 10}s`,
            animationDelay: `${((index * 13) % 8) / 10}s`,
          }}
        />
      ))}
    </div>
  );
}
