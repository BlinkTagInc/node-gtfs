declare module 'sqlstring-sqlite' {
  type SqlString = {
    format: (str: string, args: any[]) => string;
    escape: (str: string) => string;
  };
  export default SqlString;
}
