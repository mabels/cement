import { normalize, relative } from 'path'
import { RunnerTestCase, RunnerTestFile } from 'vitest'
import { createMethodsRPC, type WorkspaceProject } from 'vitest/node'
import type { ProcessPool, Vitest } from 'vitest/node'
import { $ } from 'zx'

export default function (vitest: Vitest): ProcessPool {

    // console.log("deno-runner", args)

    return {
        name: "deno-runner",
        runTests: async (specs: [project: WorkspaceProject, testFile: string][]): Promise<void> => {
            // vitest.logger.console.warn('[pool] printing:', options.print)
            // vitest.logger.console.warn('[pool] array option', options.array)
            // console.log("deno-runner:runTests", files[0][1])
            // $.verbose = true
            // await $`
            //   deno run --quiet --allow-net --allow-write --allow-run  --allow-sys --allow-ffi \
            //      --allow-read --allow-env  ./node_modules/vitest/vitest.mjs --run --project node ${files[0][1]}
            // `

            for (const [project, file] of specs) {
                vitest.state.clearFiles(project)
                const methods = createMethodsRPC(project)
                vitest.logger.console.warn('[pool] running tests for', project.getName(), 'in', normalize(file).toLowerCase().replace(normalize(process.cwd()).toLowerCase(), ''))
                const path = relative(project.config.root, file)
                const taskFile: RunnerTestFile = {
                  id: `${path}${project.getName()}`,
                  name: path,
                  mode: 'run',
                  meta: {},
                  projectName: project.getName(),
                  filepath: file,
                  type: 'suite',
                  tasks: [],
                  result: {
                    state: 'pass',
                  },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  file: null!,
                }
                taskFile.file = taskFile
                const taskTest: RunnerTestCase = {
                  type: 'test',
                  name: 'custom test',
                  id: 'custom-test',
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                  context: {} as any,
                  suite: taskFile,
                  mode: 'run',
                  meta: {},
                  file: taskFile,
                  result: {
                    state: 'pass',
                  },
                }
                taskFile.tasks.push(taskTest)
                await methods.onCollected([taskFile])
                await methods.onTaskUpdate(getTasks(taskFile).map(task => [task.id, task.result, task.meta]))
            }
            // return Promise.resolve()
        },
        collectTests: (files: [project: WorkspaceProject, testFile: string][], invalidates?: string[]): Promise<void> => {
            console.log("deno-runner:collectTests", files, invalidates)
            return Promise.resolve()
        },
        close: (): Promise<void> => {
            console.log("deno-runner:close")
            return Promise.resolve()
        }
    }

}

/*
import type { RunnerTestFile, RunnerTestCase } from 'vitest'
import type { ProcessPool, Vitest } from 'vitest/node'
import { createMethodsRPC } from 'vitest/node'
import { getTasks } from '@vitest/runner/utils'
import { normalize, relative } from 'pathe'

export default (vitest: Vitest): ProcessPool => {
  const options = vitest.config.poolOptions?.custom as any
  return {
    name: 'custom',
    async collectTests() {
      throw new Error('Not implemented')
    },
    async runTests(specs) {
      vitest.logger.console.warn('[pool] printing:', options.print)
      vitest.logger.console.warn('[pool] array option', options.array)
      for (const [project, file] of specs) {
        vitest.state.clearFiles(project)
        const methods = createMethodsRPC(project)
        vitest.logger.console.warn('[pool] running tests for', project.name, 'in', normalize(file).toLowerCase().replace(normalize(process.cwd()).toLowerCase(), ''))
        const path = relative(project.config.root, file)
        const taskFile: RunnerTestFile = {
          id: `${path}${project.name}`,
          name: path,
          mode: 'run',
          meta: {},
          projectName: project.name,
          filepath: file,
          type: 'suite',
          tasks: [],
          result: {
            state: 'pass',
          },
          file: null!,
        }
        taskFile.file = taskFile
        const taskTest: RunnerTestCase = {
          type: 'test',
          name: 'custom test',
          id: 'custom-test',
          context: {} as any,
          suite: taskFile,
          mode: 'run',
          meta: {},
          file: taskFile,
          result: {
            state: 'pass',
          },
        }
        taskFile.tasks.push(taskTest)
        await methods.onCollected([taskFile])
        await methods.onTaskUpdate(getTasks(taskFile).map(task => [task.id, task.result, task.meta]))
      }
    },
    close() {
      vitest.logger.console.warn('[pool] custom pool is closed!')
    },
  }
}
  */