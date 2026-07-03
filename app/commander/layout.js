import { Dancing_Script } from "next/font/google";

const scriptFont = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function CommanderLayout({ children }) {
  return <div className={scriptFont.variable}>{children}</div>;
}
