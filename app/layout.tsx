import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tic Tide Tac Toe",
  description: "Classic tic-tac-toe, drawn in the sand. Play locally, against a bot, or online.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {/* Global SVG filter definitions referenced by CSS (filter: url(#id)) */}
        <svg
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>
            {/* Wavy displacement for beach sand-stripe texture */}
            <filter id="ripple" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".004 .012"
                numOctaves="2"
                seed="7"
                result="r"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="r"
                scale="80"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            {/* Torn/rough edge for leaderboard panel */}
            <filter id="edge" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".035"
                numOctaves="3"
                seed="2"
                result="e"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="e"
                scale="9"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
