import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'

export interface IRpcSessionParams {
  readonly req: IncomingMessage
  readonly ws: WebSocket
}

export interface IRpcSession extends IRpcSessionParams {
  finalize(): void
  isAlive: boolean
  isAuthentic: boolean
}

export class RpcSession implements IRpcSession {
  isAlive: boolean = true
  isAuthentic: boolean = false
  readonly req: IncomingMessage
  readonly ws: WebSocket

  constructor (p: IRpcSessionParams) {
    this.req = p.req
    this.ws = p.ws
  }

  finalize (): void {
    this.ws.terminate()
  }
}
