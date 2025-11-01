// Polyfill para File API en Node.js 18
// Node.js 20+ incluye File nativamente como parte de las Web APIs
// Node.js 18 requiere un polyfill para que cheerio/undici funcione correctamente

// Verificar si File ya está disponible (Node.js 20+)
if (typeof globalThis.File === 'undefined') {
    // Node.js 18 - necesitamos crear un polyfill
    // Esto debe hacerse ANTES de que cheerio/undici intente usar File
    
    // Obtener Blob (disponible en Node.js 18+)
    const BlobConstructor = globalThis.Blob || class Blob {
        constructor(parts?: any, options?: any) {
            this.size = 0;
            this.type = options?.type || '';
        }
        size: number;
        type: string;
        async arrayBuffer(): Promise<ArrayBuffer> { return new ArrayBuffer(0); }
        async text(): Promise<string> { return ''; }
    };
    
    // Crear una clase File básica compatible con la especificación Web File API
    // Extender Blob es necesario para compatibilidad
    class FilePolyfill extends BlobConstructor {
        name: string;
        lastModified: number;
        
        constructor(
            parts?: (string | Blob | ArrayBuffer | ArrayBufferView)[],
            name: string = '',
            options?: { type?: string; lastModified?: number }
        ) {
            super(parts || [], options);
            this.name = name;
            this.lastModified = options?.lastModified ?? Date.now();
        }
    }
    
    // Asignar el polyfill a globalThis
    (globalThis as any).File = FilePolyfill;
}

export {};

