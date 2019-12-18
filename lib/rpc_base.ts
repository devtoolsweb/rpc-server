export interface IBaseRpcMiddleware {
  readonly name?: string
}

export interface IBaseRpcServer {
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares: Map<string, IBaseRpcMiddleware>
  readonly port: number
}

export interface IBaseRpcServerOpts {
  env?: Record<string, any>
  host?: string
  port?: number
}

export class BaseRpcServer implements IBaseRpcServer {
  static readonly standardHost = 'localhost'
  static readonly standardPort = 9555

  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares = new Map<string, IBaseRpcMiddleware>()
  readonly port: number

  constructor (p: IBaseRpcServerOpts) {
    this.env = p.env || {}
    this.host = p.host || BaseRpcServer.standardHost
    this.port = p.port || BaseRpcServer.standardPort
  }

  addMiddleware (m: IBaseRpcMiddleware, alias?: string): this {
    const name = m.name || alias
    if (name) {
      this.middlewares.set(name, m)
      return this
    }
    throw new Error(`Middleware name must be specified`)
  }
}
