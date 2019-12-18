import { Server, createServer } from 'http'
import {
  IRpcRequest,
  IRpcResponseOpts,
  RpcError,
  RpcErrorCodeEnum,
  RpcRequest,
  RpcResponse
} from '@aperos/rpc-common'
import { IRpcMiddleware } from './rpc_middleware'
import { IRpcSession } from './rpc_session'
import { IRpcServerOpts, RpcServer } from './rpc_server'

export class RpcHttpServer extends RpcServer {
  static standardHeartbeatTimeout = 30000

  protected readonly server: Server
  private isInitialized = false

  constructor (p: IRpcServerOpts) {
    super(p)
    this.server = createServer(async (request, response) => {
      if (request.method !== 'POST') {
        response.statusCode = 400
        response.write('400: RPC server only allows POST requests')
        response.end()
        return
      }
      // TODO: Handle message sending errors
      const chunks = new Array<any>()
      request.on('data', chunk => chunks.push(chunk))
      request.on('end', async () => {
        const postData = Buffer.concat(chunks)
        const rpcRequest = new RpcRequest(
          RpcRequest.makePropsFromJson(postData.toJSON())
        )
        const rpcResponse = await this.dispatchRequest(rpcRequest)
        this.emit('request', { request: rpcRequest, server: this })
        /**
         * The HTTP error code will always be 200, regardless of the result
         * of the RPC request.
         */
        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify(rpcResponse))
        response.end()
        this.emit('response', {
          response: rpcResponse,
          server: this
        })
      })
    })
  }

  protected authenticateRequest (_r: IRpcRequest): boolean {
    return true
  }

  private async dispatchRequest (request: IRpcRequest) {
    const m = this.middlewares.get(request.domain)
    const opts: IRpcResponseOpts = { id: request.id! }
    if (m) {
      opts.result = await (m as IRpcMiddleware).handleRequest(request)
    } else {
      opts.error = new RpcError({
        code: RpcErrorCodeEnum.InvalidRequest,
        message: `Unknown RPC message domain: '${request.domain}'`
      })
    }
    return new RpcResponse(opts)
  }

  async start () {
    await this.ensureInitialized()
    this.server.listen(this.port, this.host)
  }

  async stop () {
    if (this.server.listening) {
      this.server.close()
    }
  }

  protected async authenticateSession (s: IRpcSession) {
    s.isAuthentic = true
  }

  private async ensureInitialized () {
    if (!this.isInitialized) {
      for (const m of this.middlewares.values()) {
        await (m as IRpcMiddleware).setup({ server: this })
      }
      this.isInitialized = true
    }
  }
}
