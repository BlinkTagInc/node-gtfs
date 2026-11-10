import { homedir } from 'node:os';

const homeDirectory = homedir();

export function expandHomeDirectory(pathWithTilde: string): string {
  return homeDirectory
    ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathWithTilde;
}
