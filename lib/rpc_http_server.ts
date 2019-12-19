import { Server, createServer, ServerResponse } from 'http'
import { IRpcServerOpts, RpcServer } from './rpc_server'

export class RpcHttpServer extends RpcServer {
  static standardHeartbeatTimeout = 30000

  protected readonly server: Server

  constructor (p: IRpcServerOpts) {
    super(p)
    this.server = createServer(async (request, response) => {
      const origin = (request.headers as any).origin
      if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Credentials', 'true')
        response.setHeader('Access-Control-Allow-Origin', origin)
        response.setHeader(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        )
        response.setHeader('Content-Type', 'application/json')
        response.statusCode = 200
        response.end()
      } else if (request.method !== 'POST') {
        response.statusCode = 400
        response.write('400: RPC server only allows POST requests')
        response.end()
      } else {
        const chunks = new Array<any>()
        request.on('data', chunk => chunks.push(chunk))
        request.on('end', async () => {
          const postData = Buffer.concat(chunks).toString()
          this.handlePostData(response, postData, origin)
        })
      }
    })
  }

  protected async handlePostData (
    httpResponse: ServerResponse,
    postData: string,
    origin: string
  ) {
    const response = await this.handleRequestData(postData)
    try {
      /**
       * The standard HTTP error code for any RPC responses should be 200,
       * regardless of whether the RPC response contains an error or not.
       */
      httpResponse.setHeader('Access-Control-Allow-Credentials', 'true')
      httpResponse.setHeader('Access-Control-Allow-Origin', origin)
      httpResponse.setHeader('Content-Type', 'application/json')
      const s = JSON.stringify(response)
      httpResponse.write(s)
      httpResponse.end()
      this.emit('response', { response, server: this })
    } catch (e) {
      this.emit('error', {
        server: this,
        errorDescription: `Error sending response to client -- ${e.message}`
      })
    }
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
