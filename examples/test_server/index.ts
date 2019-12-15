import { RpcServer, IRpcServer } from '../../lib'
import { TestMiddleware } from './test_middleware'

const host = 'localhost'
const port = 3000

console.log(`Running RPC server at http://${host}:${port}`)
const rpcServer: IRpcServer = new RpcServer({ host, port })

rpcServer.on('request', event =>
  console.log(`Client sent request:`, JSON.stringify(event.request, null, '  '))
)

rpcServer.on('response', event =>
  console.log(
    `Server sent response at ${new Date()} :`,
    JSON.stringify(event.response, null, '  ')
  )
)

rpcServer.addMiddleware(new TestMiddleware(), { name: 'TestDomain' }).start()
