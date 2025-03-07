interface ImportMetaEnv {
    readonly XATA_API_KEY: string;
    readonly XATA_BRANCH?: string;
    readonly XATA_DATABASE_URL?: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }