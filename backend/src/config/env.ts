import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

let envLoaded = false;

function tryLoadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  dotenv.config({ path: filePath, override: false });
  return true;
}

if (!envLoaded) {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', '..', '.env'),
  ];

  for (const candidatePath of candidatePaths) {
    if (tryLoadEnvFile(candidatePath)) {
      envLoaded = true;
      break;
    }
  }
}

export {};