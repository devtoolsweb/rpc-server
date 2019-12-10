export interface IBaseRpcMiddleware {}

export interface IBaseRpcServer {
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares: Map<string, IBaseRpcMiddleware>
  readonly port: number
}

export interface IBaseRpcServerParams {
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

  constructor (p: IBaseRpcServerParams) {
    this.env = p.env || {}
    this.host = p.host || BaseRpcServer.standardHost
    this.port = p.port || BaseRpcServer.standardPort
  }
}
