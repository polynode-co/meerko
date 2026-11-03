/** The Slack app manifest for a Meerko API at `apiUrl`. Shown in the docs; docs/slack-app-manifest.yml is Meerko Cloud's. */
export function slackManifest(apiUrl: string): string {
  const api = apiUrl.replace(/\/$/, "");
  return `display_information:
  name: Meerko
  description: Replies and drafts from Meerko, with Approve buttons
features:
  bot_user:
    display_name: Meerko
    always_online: false
  slash_commands:
    - command: /meerko
      url: ${api}/slack/commands
      description: What's waiting in Meerko
      should_escape: false
oauth_config:
  redirect_urls:
    - ${api}/slack/oauth/callback
  scopes:
    bot:
      - chat:write
      - chat:write.public
      - commands
      - incoming-webhook
      - users:read
      - users:read.email
settings:
  interactivity:
    is_enabled: true
    request_url: ${api}/slack/interactions
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false`;
}
