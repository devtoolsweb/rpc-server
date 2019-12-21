import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'

export interface IRpcSessionOpts {
  readonly req: IncomingMessage
  readonly ws: WebSocket
}

export interface IRpcSession extends IRpcSessionOpts {
  finalize(): void
  isAlive: boolean
}

export class RpcSession implements IRpcSession {
  isAlive: boolean = true
  readonly req: IncomingMessage
  readonly ws: WebSocket

  constructor (p: IRpcSessionOpts) {
    this.req = p.req
    this.ws = p.ws
  }

  finalize (): void {
    this.ws.terminate()
  }
}
