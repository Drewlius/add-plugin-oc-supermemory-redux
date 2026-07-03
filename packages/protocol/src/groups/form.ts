import { Form } from "@opencode-ai/schema/form"
import { Location } from "@opencode-ai/schema/location"
import { Session } from "@opencode-ai/schema/session"
import { Context, Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import {
  ConflictError,
  FormAlreadySettledError,
  FormInvalidAnswerError,
  FormNotFoundError,
  InvalidRequestError,
  SessionNotFoundError,
} from "../errors.js"
import { LocationQuery, locationQueryOpenApi } from "./location.js"

const CreatePayload = Schema.Struct({
  id: Form.ID.pipe(Schema.optional),
  title: Form.FormInfo.fields.title,
  metadata: Form.FormInfo.fields.metadata,
  mode: Schema.Literals(["form", "url"]),
  fields: Form.FormInfo.fields.fields.pipe(Schema.optional),
  url: Form.UrlInfo.fields.url.pipe(Schema.optional),
}).annotate({ identifier: "Form.CreatePayload" })

export type CreatePayload = typeof CreatePayload.Type

const CreateGlobalPayload = Schema.Struct({
  ...CreatePayload.fields,
  // Opaque owner identifier; not required to reference a persisted session row.
  sessionID: Schema.String,
}).annotate({ identifier: "Form.CreateGlobalPayload" })

export type CreateGlobalPayload = typeof CreateGlobalPayload.Type

export const makeFormGroup = <
  LocationId extends HttpApiMiddleware.AnyId,
  LocationService,
  SessionLocationId extends HttpApiMiddleware.AnyId,
  SessionLocationService,
>(
  locationMiddleware: Context.Key<LocationId, LocationService>,
  sessionLocationMiddleware: Context.Key<SessionLocationId, SessionLocationService>,
) =>
  HttpApiGroup.make("server.form")
    .add(
      HttpApiEndpoint.get("form.request.list", "/api/form/request", {
        query: LocationQuery,
        success: Location.response(Schema.Array(Form.Info)),
      })
        .annotateMerge(locationQueryOpenApi)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.form.request.list",
            summary: "List pending form requests",
            description: "Retrieve pending forms for a location.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("form.create", "/api/form", {
        query: LocationQuery,
        payload: CreateGlobalPayload,
        success: Schema.Struct({ data: Form.Info }),
        error: [ConflictError, InvalidRequestError],
      })
        .annotateMerge(locationQueryOpenApi)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.form.create",
            summary: "Create form",
            description: "Create a form owned by an arbitrary session identifier.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.get("form.get", "/api/form/:formID", {
        params: { formID: Form.ID },
        query: LocationQuery,
        success: Schema.Struct({ data: Form.Info }),
        error: FormNotFoundError,
      })
        .annotateMerge(locationQueryOpenApi)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.form.get",
            summary: "Get form",
            description: "Retrieve a form by ID.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.get("form.state", "/api/form/:formID/state", {
        params: { formID: Form.ID },
        query: LocationQuery,
        success: Schema.Struct({ data: Form.State }),
        error: FormNotFoundError,
      })
        .annotateMerge(locationQueryOpenApi)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.form.state",
            summary: "Get form state",
            description: "Retrieve the current state for a form.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("form.reply", "/api/form/:formID/reply", {
        params: { formID: Form.ID },
        query: LocationQuery,
        payload: Form.Reply,
        success: HttpApiSchema.NoContent,
        error: [FormAlreadySettledError, FormInvalidAnswerError, FormNotFoundError],
      })
        .annotateMerge(locationQueryOpenApi)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.form.reply",
            summary: "Reply to form",
            description: "Submit an answer to a pending form.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("form.cancel", "/api/form/:formID/cancel", {
        params: { formID: Form.ID },
        query: LocationQuery,
        success: HttpApiSchema.NoContent,
        error: [FormAlreadySettledError, FormNotFoundError],
      })
        .annotateMerge(locationQueryOpenApi)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.form.cancel",
            summary: "Cancel form",
            description: "Cancel a pending form.",
          }),
        ),
    )
    .middleware(locationMiddleware)
    .add(
      HttpApiEndpoint.get("session.form.list", "/api/session/:sessionID/form", {
        params: { sessionID: Session.ID },
        success: Schema.Struct({ data: Schema.Array(Form.Info) }),
        error: SessionNotFoundError,
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.form.list",
            summary: "List session forms",
            description: "Retrieve pending forms for a session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("session.form.create", "/api/session/:sessionID/form", {
        params: { sessionID: Session.ID },
        payload: CreatePayload,
        success: Schema.Struct({ data: Form.Info }),
        error: [SessionNotFoundError, ConflictError, InvalidRequestError],
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.form.create",
            summary: "Create session form",
            description: "Create a form for a session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.get("session.form.get", "/api/session/:sessionID/form/:formID", {
        params: { sessionID: Session.ID, formID: Form.ID },
        success: Schema.Struct({ data: Form.Info }),
        error: [SessionNotFoundError, FormNotFoundError],
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.form.get",
            summary: "Get session form",
            description: "Retrieve a form for a session.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.get("session.form.state", "/api/session/:sessionID/form/:formID/state", {
        params: { sessionID: Session.ID, formID: Form.ID },
        success: Schema.Struct({ data: Form.State }),
        error: [SessionNotFoundError, FormNotFoundError],
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.form.state",
            summary: "Get form state",
            description: "Retrieve the current state for a form.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("session.form.reply", "/api/session/:sessionID/form/:formID/reply", {
        params: { sessionID: Session.ID, formID: Form.ID },
        payload: Form.Reply,
        success: HttpApiSchema.NoContent,
        error: [SessionNotFoundError, FormAlreadySettledError, FormInvalidAnswerError, FormNotFoundError],
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.form.reply",
            summary: "Reply to form",
            description: "Submit an answer to a pending form.",
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("session.form.cancel", "/api/session/:sessionID/form/:formID/cancel", {
        params: { sessionID: Session.ID, formID: Form.ID },
        success: HttpApiSchema.NoContent,
        error: [SessionNotFoundError, FormAlreadySettledError, FormNotFoundError],
      })
        .middleware(sessionLocationMiddleware)
        .annotateMerge(
          OpenApi.annotations({
            identifier: "v2.session.form.cancel",
            summary: "Cancel form",
            description: "Cancel a pending form.",
          }),
        ),
    )
    .annotateMerge(OpenApi.annotations({ title: "forms", description: "Form routes." }))
