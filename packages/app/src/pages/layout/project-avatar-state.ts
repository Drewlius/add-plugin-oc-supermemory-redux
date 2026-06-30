import { createMemo, type Accessor } from "solid-js"
import { useServerSync } from "@/context/server-sync"
import { useNotification } from "@/context/notification"
import { usePermission } from "@/context/permission"
import { sessionPermissionRequest, sessionQuestionRequest } from "@/pages/session/composer/session-request-tree"

export function useSessionTabAvatarState(
  directory: Accessor<string>,
  sessionId: Accessor<string>,
  active: Accessor<boolean> = () => true,
) {
  const globalSync = useServerSync()
  const notification = useNotification()
  const permission = usePermission()
  const hasPermissions = createMemo(() => {
    if (!active()) return false
    const [store] = globalSync().child(directory(), { bootstrap: false })
    return !!sessionPermissionRequest(store.session, globalSync().session.data.permission, sessionId(), (item) => {
      return !permission.autoResponds(item, directory())
    })
  })
  const hasQuestions = createMemo(() => {
    if (!active()) return false
    const [store] = globalSync().child(directory(), { bootstrap: false })
    return !!sessionQuestionRequest(store.session, globalSync().session.data.question, sessionId())
  })
  const needsAttention = createMemo(() => hasPermissions() || hasQuestions())
  const unread = createMemo(() => active() && (needsAttention() || notification.session.unseenCount(sessionId()) > 0))
  const loading = createMemo(() => {
    if (!active()) return false
    if (needsAttention()) return false
    return globalSync().session.data.session_working(sessionId())
  })
  return { unread, loading }
}
