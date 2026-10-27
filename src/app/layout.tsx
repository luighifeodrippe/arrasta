import type { Metadata } from "next";
import {
  Anton,
  Bricolage_Grotesque,
  Caveat,
  DM_Serif_Display,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
  Montserrat,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
} from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { APP_NAME } from "@/lib/defaults";
import "./globals.css";

const ui = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-ui", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const dmserif = DM_Serif_Display({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-dmserif", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-poppins", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  title: `${APP_NAME} — carrosséis na sua voz`,
  description: "Crie carrosséis na sua voz com sua conta do ChatGPT, sem chave nem cobrança de API separada. Código aberto para rodar no seu computador.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [ui, inter, mono, montserrat, poppins, bricolage, space, instrument, playfair, dmserif, anton, caveat].map((f) => f.variable).join(" ");
  return (
    <html lang="pt-BR" className={`dark ${fonts}`}>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster theme="dark" position="top-center" offset={68} toastOptions={{ className: "arrasta-toast" }} />
      </body>
    </html>
  );
}
