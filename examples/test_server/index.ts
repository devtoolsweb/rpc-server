import 'reflect-metadata'
import Container from 'typedi'
import { Server } from './server'

const server = Container.get(Server)
server.start()
