import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite que dispositivos na rede local (ex: celular/tablet) recebam
  // hot-reload do servidor de desenvolvimento sem bloqueio de cross-origin
  allowedDevOrigins: [
    '192.168.15.18',
    '192.168.*.*',
    'localhost',
  ],
};

export default nextConfig;
