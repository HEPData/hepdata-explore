_ANSIBLE_HOSTFILE="hosts"
SERVER_IP=$(cat $_ANSIBLE_HOSTFILE |head -n2 |tail -n1 |cut -d' ' -f1)

# workaround for https://github.com/ansible/ansible/issues/13401
export ANSIBLE_SCP_IF_SSH=y

alias playbook="ansible-playbook -i $_ANSIBLE_HOSTFILE"
alias ansible="ansible -i $_ANSIBLE_HOSTFILE hepdata"
alias shell="ssh root@$SERVER_IP"
alias site="playbook site.yaml"
alias tag="site --tags"
alias tags="tag"

function mkrole() {
  set -eu
  mkdir -p roles/$1/{files,handlers,tasks,templates}
  touch roles/$1/tasks/main.yaml
  touch roles/$1/handlers/main.yaml
}
