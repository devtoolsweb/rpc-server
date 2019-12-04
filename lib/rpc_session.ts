import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'

export interface IRpcSessionParams {
  readonly req: IncomingMessage
  readonly ws: WebSocket
}

export interface IRpcSession extends IRpcSessionParams {
  isAlive: boolean
  finalize(): void
}

export class RpcSession implements IRpcSession {
  readonly req: IncomingMessage
  readonly ws: WebSocket
  isAlive: boolean = true

  constructor (p: IRpcSessionParams) {
    this.req = p.req
    this.ws = p.ws
  }

  finalize (): void {
    this.ws.terminate()
  }
}
