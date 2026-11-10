#!/bin/bash
# Vercel "ignore build step": decides whether a push should be built and deployed.
#   exit 1 = build and deploy      exit 0 = skip
# Only the integration branch and the live branches deploy, so pull-request branches do not use up the daily build
# limit. (main stays in the list until it is retired as the Vercel production branch.) GitHub Actions still tests every
# pull request.
case "${VERCEL_GIT_COMMIT_REF:-}" in
  "" | main | self-service-development | self-service-production)
    echo "Building ${VERCEL_GIT_COMMIT_REF:-(no branch: manual deploy)}"
    exit 1
    ;;
  *)
    echo "Skipping ${VERCEL_GIT_COMMIT_REF}: only development and production branches deploy"
    exit 0
    ;;
esac
