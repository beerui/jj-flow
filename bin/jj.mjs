#!/usr/bin/env node
import process from 'node:process';
import { runCli } from '../src/cli.mjs';

process.exit(runCli(process.argv.slice(2)));
