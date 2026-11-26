# Runs inside the mongo container: <tool> [args], with the root credentials passed in a mode 600
# --config file, so they never show in a process list.
set -euo pipefail
umask 077

read_env() {
  local value
  value=$(sed -n "s/^$1=//p" /run/config/.env | tail -n 1)
  value=${value%$'\r'}
  case $value in
    \"*\" | \'*\') value=${value:1:${#value}-2} ;;
  esac
  [ -n "$value" ] || { echo "error: $1 is not set in the mounted env file" >&2; return 1; }
  printf %s "$value"
}

# Percent-encodes every byte, so no character needs URI or YAML escaping.
encode() {
  printf %s "$1" | od -An -v -tx1 | tr -d ' \n' | sed 's/../%&/g'
}

user=$(read_env MONGO_USERNAME)
password=$(read_env MONGO_PASSWORD)
config=$(mktemp /tmp/mongo-tool.XXXXXX)
trap 'rm -f "$config"' EXIT
printf 'uri: mongodb://%s:%s@localhost:27017/?authSource=admin&directConnection=true\n' \
  "$(encode "$user")" "$(encode "$password")" > "$config"

"$@" --config="$config"
