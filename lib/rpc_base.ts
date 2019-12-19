export interface IBaseRpcMiddleware {
  readonly name?: string
}

export interface IBaseRpcServer {
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares: Map<string, IBaseRpcMiddleware>
  readonly port: number
}

export class BaseRpcServer {}

export class BaseRpcMiddleware {
  get name() {
    return ''
  }
}
