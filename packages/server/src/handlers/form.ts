import { Form } from "@opencode-ai/core/form"
import {
  ConflictError,
  FormAlreadySettledError,
  FormInvalidAnswerError,
  FormNotFoundError,
  InvalidRequestError,
} from "@opencode-ai/protocol/errors"
import type { CreatePayload } from "@opencode-ai/protocol/groups/form"
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "../api"
import { response } from "../location"

function missingForm(id: Form.ID) {
  return new FormNotFoundError({ id, message: `Form not found: ${id}` })
}

function createInput(payload: CreatePayload, sessionID: string) {
  const common = {
    id: payload.id,
    sessionID,
    title: payload.title,
    metadata: payload.metadata,
  }
  if (payload.mode === "form") {
    if (!payload.fields) {
      return Effect.fail(new InvalidRequestError({ message: "Form fields are required", field: "fields" }))
    }
    return Effect.succeed({ ...common, mode: "form" as const, fields: payload.fields })
  }
  if (!payload.url) return Effect.fail(new InvalidRequestError({ message: "Form URL is required", field: "url" }))
  return Effect.succeed({ ...common, mode: "url" as const, url: payload.url })
}

export const FormHandler = HttpApiBuilder.group(Api, "server.form", (handlers) =>
  Effect.gen(function* () {
    const requireOwnedForm = Effect.fnUntraced(function* (sessionID: Form.Info["sessionID"], formID: Form.ID) {
      const form = yield* Form.Service
      const info = yield* form.get(formID).pipe(Effect.catchTag("Form.NotFoundError", () => missingForm(formID)))
      if (info.sessionID !== sessionID) return yield* missingForm(formID)
      return { form, info }
    })

    return handlers
      .handle(
        "form.request.list",
        Effect.fn(function* () {
          const form = yield* Form.Service
          return yield* response(form.list())
        }),
      )
      .handle(
        "form.create",
        Effect.fn(function* (ctx) {
          const form = yield* Form.Service
          const input = yield* createInput(ctx.payload, ctx.payload.sessionID)
          const created = yield* form
            .create(input)
            .pipe(
              Effect.catchTag(
                "Form.AlreadyExistsError",
                (error) => new ConflictError({ resource: error.id, message: error.message }),
              ),
            )
          return { data: created }
        }),
      )
      .handle(
        "form.get",
        Effect.fn(function* (ctx) {
          const form = yield* Form.Service
          const data = yield* form
            .get(ctx.params.formID)
            .pipe(Effect.catchTag("Form.NotFoundError", () => missingForm(ctx.params.formID)))
          return { data }
        }),
      )
      .handle(
        "form.state",
        Effect.fn(function* (ctx) {
          const form = yield* Form.Service
          const data = yield* form
            .state(ctx.params.formID)
            .pipe(Effect.catchTag("Form.NotFoundError", () => missingForm(ctx.params.formID)))
          return { data }
        }),
      )
      .handle(
        "form.reply",
        Effect.fn(function* (ctx) {
          const form = yield* Form.Service
          yield* form.reply({ id: ctx.params.formID, answer: ctx.payload.answer }).pipe(
            Effect.catchTags({
              "Form.AlreadySettledError": (error) =>
                new FormAlreadySettledError({ id: error.id, message: error.message }),
              "Form.InvalidAnswerError": (error) =>
                new FormInvalidAnswerError({ id: error.id, message: error.message }),
              "Form.NotFoundError": () => missingForm(ctx.params.formID),
            }),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "form.cancel",
        Effect.fn(function* (ctx) {
          const form = yield* Form.Service
          yield* form.cancel(ctx.params.formID).pipe(
            Effect.catchTags({
              "Form.AlreadySettledError": (error) =>
                new FormAlreadySettledError({ id: error.id, message: error.message }),
              "Form.NotFoundError": () => missingForm(ctx.params.formID),
            }),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "session.form.list",
        Effect.fn(function* (ctx) {
          const form = yield* Form.Service
          const forms = yield* form.list({ sessionID: ctx.params.sessionID })
          return { data: forms }
        }),
      )
      .handle(
        "session.form.create",
        Effect.fn(function* (ctx) {
          const form = yield* Form.Service
          const input = yield* createInput(ctx.payload, ctx.params.sessionID)
          const created = yield* form
            .create(input)
            .pipe(
              Effect.catchTag(
                "Form.AlreadyExistsError",
                (error) => new ConflictError({ resource: error.id, message: error.message }),
              ),
            )
          return { data: created }
        }),
      )
      .handle(
        "session.form.get",
        Effect.fn(function* (ctx) {
          const owned = yield* requireOwnedForm(ctx.params.sessionID, ctx.params.formID)
          return { data: owned.info }
        }),
      )
      .handle(
        "session.form.state",
        Effect.fn(function* (ctx) {
          const owned = yield* requireOwnedForm(ctx.params.sessionID, ctx.params.formID)
          const data = yield* owned.form
            .state(ctx.params.formID)
            .pipe(Effect.catchTag("Form.NotFoundError", () => missingForm(ctx.params.formID)))
          return { data }
        }),
      )
      .handle(
        "session.form.reply",
        Effect.fn(function* (ctx) {
          const owned = yield* requireOwnedForm(ctx.params.sessionID, ctx.params.formID)
          yield* owned.form.reply({ id: ctx.params.formID, answer: ctx.payload.answer }).pipe(
            Effect.catchTags({
              "Form.AlreadySettledError": (error) =>
                new FormAlreadySettledError({ id: error.id, message: error.message }),
              "Form.InvalidAnswerError": (error) =>
                new FormInvalidAnswerError({ id: error.id, message: error.message }),
              "Form.NotFoundError": () => missingForm(ctx.params.formID),
            }),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "session.form.cancel",
        Effect.fn(function* (ctx) {
          const owned = yield* requireOwnedForm(ctx.params.sessionID, ctx.params.formID)
          yield* owned.form.cancel(ctx.params.formID).pipe(
            Effect.catchTags({
              "Form.AlreadySettledError": (error) =>
                new FormAlreadySettledError({ id: error.id, message: error.message }),
              "Form.NotFoundError": () => missingForm(ctx.params.formID),
            }),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
  }),
)
