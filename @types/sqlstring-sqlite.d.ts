declare module 'sqlstring-sqlite' {
  const SqlString = {
    format: (str: string, args: any[]) => string,
    escape: (str: string) => string,
    escapeId: (str: string) => string,
  };
  export default SqlString;
}
