# Sourced by backup.sh and restore-verify.sh (host side, macOS bash 3.2).
die() {
  echo "error: $*" >&2
  exit 1
}

# Sets $cid to the running container of the Swarm service helixo_mongo.
find_mongo() {
  cid=$(docker ps -q --filter label=com.docker.swarm.service.name=helixo_mongo --filter status=running) ||
    die "cannot reach Docker. Is Docker Desktop running?"
  cid=${cid%%$'\n'*}
  [ -n "$cid" ] || die "the helixo_mongo service has no running container. Start it with: docker stack deploy -c docker-compose.yml helixo"
}

# mongo_tool [docker exec options] -- <mongodump|mongorestore> [args]: authenticated, as root in the container.
mongo_tool() {
  local options=()
  while [ "$1" != "--" ]; do
    options+=("$1")
    shift
  done
  shift
  docker exec -u root ${options[@]+"${options[@]}"} "$cid" bash -c "$(cat "$tools/mongo/with-config.sh")" with-config "$@"
}
