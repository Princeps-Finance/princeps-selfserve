import json
from pathlib import Path

snapshot = Path("docs/api/self-service-v2.openapi.json")
output = Path("src/app/features/apply/data-access/application-contract.ts")
schemas = json.loads(snapshot.read_text())["components"]["schemas"]

# The client generates its contract from the DTOs it consumes and their dependencies.
roots = (
    "AcceptOfferLetterResponseDto", "ApplicationViewDto", "BankItemDto",
    "CancelApplicationDto", "CancelledResponseDto", "ClosedResponseDto",
    "ContactUnreachableResponseDto", "DocumentStatusDto", "EligibleOfferDto",
    "EmployerItemDto", "EmploymentDto", "EmploymentResponseDto", "EmploymentTypeItemDto",
    "IdentityStatusDto", "LockedOfferDto", "MandatesResponseDto", "MdaItemDto",
    "OfferLetterResponseDto", "OffersResponseDto", "PresignDocumentDto",
    "PresignDocumentResponseDto", "ProfileDto", "ProfileFormResponseDto", "ProfileValuesDto",
    "QuoteDto", "QuoteResponseDto", "ResolveAccountDto", "ResolveAccountResponseDto",
    "SalaryDto", "SalaryViewDto", "SendOtpDto", "SendOtpResponseDto",
    "StartApplicationDto", "StartApplicationResponseDto", "StateItemDto", "SubmissionStatusDto",
)

https = 'z.url().check(z.refine(value => new URL(value).protocol === "https:", "HTTPS required"))'
nullable_objects = {
    **dict.fromkeys(
        ("externalId", "reference", "suggestedNext", "whatsapp", "email", "phone", "loanId", "errorMessage"),
        "z.nullable(z.string())",
    ),
    "monthlyIncome": "z.nullable(z.number().check(z.nonnegative()))",
    "rate": "z.nullable(z.number())",
    "actionUrl": f"z.nullable({https})",
}
scalar_types = {"string": "z.string()", "number": "z.number()", "boolean": "z.boolean()"}
lines = [
    "// Generated from the pinned application API contract by scripts/generate-contracts.py.",
    "import { z } from 'zod/mini';",
]
emitted = set()


def parser(spec, field=""):
    if not isinstance(spec, dict):
        return "z.unknown()"
    if field == "signingUrl":
        return https
    if "$ref" in spec:
        name = spec["$ref"].rsplit("/", 1)[-1]
        emit(name)
        return name + "Schema"
    if "allOf" in spec:
        parts = [parser(part, field) for part in spec["allOf"]]
        result = parts[0]
        for part in parts[1:]:
            result = f"z.intersection({result}, {part})"
        return result
    if "enum" in spec:
        return f"z.enum({json.dumps(spec['enum'])})"

    type_name = spec.get("type")
    if type_name == "array":
        return f"z.array({parser(spec['items'])})"
    if type_name != "object":
        return scalar_types.get(type_name, "z.unknown()")
    if spec.get("nullable") and field in nullable_objects:
        return nullable_objects[field]
    if "properties" not in spec:
        return f"z.record(z.string(), {parser(spec.get('additionalProperties'))})"

    properties = spec["properties"]
    required = set(spec.get("required", []))
    if "identityRequired" in properties:
        # The published document examples can omit these flags.
        required.difference_update(("identityDone", "digisignAvailable"))
    fields = []
    for key, value in properties.items():
        property_parser = parser(value, key)
        if key not in required:
            property_parser = f"z.optional({property_parser})"
        fields.append(f"  {json.dumps(key)}: {property_parser},")
    return "z.object({\n" + "\n".join(fields) + "\n})"


def emit(name):
    if name in emitted:
        return
    # Swagger's LGA item references an empty String object. The examples are strings.
    value = "z.string()" if name == "String" else parser(schemas[name])
    lines.extend((
        "",
        f"export const {name}Schema = {value};",
        f"export type {name} = z.infer<typeof {name}Schema>;",
    ))
    emitted.add(name)


for name in roots:
    emit(name)
output.write_text("\n".join(lines) + "\n")
