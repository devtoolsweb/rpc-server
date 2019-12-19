import { Server, createServer } from 'http'
import { RpcRequest } from '@aperos/rpc-common'
import { IRpcServerOpts, RpcServer } from './rpc_server'

export class RpcHttpServer extends RpcServer {
  static standardHeartbeatTimeout = 30000

  protected readonly server: Server

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
         * The standard HTTP error code for any RPC responses should be 200,
         * regardless of whether the RPC response contains an error or not.
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

  protected async performStart () {
    this.server.listen(this.port, this.host)
  }

  protected async performStop () {
    if (this.server.listening) {
      this.server.close()
    }
  }
}
