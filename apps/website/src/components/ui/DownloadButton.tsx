"use client";

import { useEffect, useState } from "react";
import { Download, Monitor, Apple, Terminal } from "lucide-react";
import { motion } from "framer-motion";

type OS = "Windows" | "macOS" | "Linux" | "Unknown";

export default function DownloadButton() {
  const [os, setOs] = useState<OS>("Unknown");
  
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) setOs("Windows");
    else if (userAgent.includes("mac")) setOs("macOS");
    else if (userAgent.includes("linux")) setOs("Linux");
  }, []);

  const getDownloadInfo = () => {
    // Note: These URLs represent the GitHub Actions release strategy
    const baseUrl = "https://github.com/AetherDesk/AetherDesk/releases/latest/download";
    switch (os) {
      case "Windows": return { text: "Download for Windows", icon: <Monitor className="w-5 h-5 mr-2" />, url: `${baseUrl}/AetherDeskSetup.exe` };
      case "macOS": return { text: "Download for macOS", icon: <Apple className="w-5 h-5 mr-2" />, url: `${baseUrl}/AetherDesk.dmg` };
      case "Linux": return { text: "Download for Linux", icon: <Terminal className="w-5 h-5 mr-2" />, url: `${baseUrl}/AetherDesk.AppImage` };
      default: return { text: "Download AetherDesk", icon: <Download className="w-5 h-5 mr-2" />, url: "https://github.com/AetherDesk/AetherDesk/releases" };
    }
  };

  const info = getDownloadInfo();

  return (
    <motion.a 
      href={info.url}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-white font-semibold tracking-wide shadow-[0_0_20px_var(--color-primary-glow)] hover:shadow-[0_0_30px_var(--color-primary-glow)] transition-all duration-300"
    >
      {info.icon}
      {info.text}
    </motion.a>
  );
}
