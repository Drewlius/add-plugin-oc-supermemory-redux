import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { app } from "electron"
import { getStore } from "./store"
import { FIRST_LAUNCH_ONBOARDING_COMPLETE_KEY } from "./store-keys"

const DEFAULT_PROJECT_DIR = "Let's go"

export function isFirstLaunchOnboardingPending() {
  return getStore().get(FIRST_LAUNCH_ONBOARDING_COMPLETE_KEY) !== true
}

export async function finishFirstLaunchOnboarding(createDefaultProject: boolean) {
  if (!isFirstLaunchOnboardingPending()) return null

  const defaultProject = createDefaultProject ? join(app.getPath("documents"), DEFAULT_PROJECT_DIR) : null
  if (defaultProject) await mkdir(defaultProject, { recursive: true })

  getStore().set(FIRST_LAUNCH_ONBOARDING_COMPLETE_KEY, true)
  return defaultProject
}
