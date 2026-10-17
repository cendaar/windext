/** Small JSON cache in front of Open-Meteo. KV on Cloudflare, none locally. */
export interface Cache { get(key: string): Promise<any | null>; put(key: string, value: any, ttlSeconds: number): Promise<void> }
export const noCache: Cache = { async get() { return null }, async put() {} }
export class KVCache implements Cache {
  constructor(private kv: KVNamespace) {}
  async get(key: string) { return this.kv.get(key, 'json') }
  async put(key: string, value: any, ttl: number) { await this.kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttl) }) }
}
