declare module 'qrcode-generator' {
  type QRCodeInstance = {
    addData: (value: string) => void;
    make: () => void;
    getModuleCount: () => number;
    isDark: (row: number, column: number) => boolean;
  };

  export default function createQRCode(typeNumber: number, errorCorrectionLevel: string): QRCodeInstance;
}