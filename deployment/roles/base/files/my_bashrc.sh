# ~/.bashrc: executed by bash(1) for non-login shells.
# see /usr/share/doc/bash/examples/startup-files (in the package bash-doc)
# for examples

# If not running interactively, don't do anything
[ -z "$PS1" ] && return

# don't put duplicate lines or lines starting with space in the history.
# See bash(1) for more options
HISTCONTROL=ignoreboth

# append to the history file, don't overwrite it
shopt -s histappend

# for setting history length see HISTSIZE and HISTFILESIZE in bash(1)
HISTSIZE=10000
HISTFILESIZE=20000

# check the window size after each command and, if necessary,
# update the values of LINES and COLUMNS.
shopt -s checkwinsize

# If set, the pattern "**" used in a pathname expansion context will
# match all files and zero or more directories and subdirectories.
#shopt -s globstar

# make less more friendly for non-text input files, see lesspipe(1)
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# set variable identifying the chroot you work in (used in the prompt below)
if [ -z "$debian_chroot" ] && [ -r /etc/debian_chroot ]; then
    debian_chroot=$(cat /etc/debian_chroot)
fi

# set a fancy prompt (non-color, unless we know we "want" color)
case "$TERM" in
    xterm-color) color_prompt=yes;;
esac

# uncomment for a colored prompt, if the terminal has the capability; turned
# off by default to not distract the user: the focus in a terminal window
# should be on the output of commands, not on the prompt
#force_color_prompt=yes

if [ -n "$force_color_prompt" ]; then
    if [ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null; then
  # We have color support; assume it's compliant with Ecma-48
  # (ISO/IEC-6429). (Lack of such support is extremely rare, and such
  # a case would tend to support setf rather than setaf.)
  color_prompt=yes
    else
  color_prompt=
    fi
fi

if [ "$color_prompt" = yes ]; then
    PS1='${debian_chroot:+($debian_chroot)}\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
else
    PS1='${debian_chroot:+($debian_chroot)}\u@\h:\w\$ '
fi
unset color_prompt force_color_prompt

# If this is an xterm set the title to user@host:dir
case "$TERM" in
xterm*|rxvt*)
    PS1="\[\e]0;${debian_chroot:+($debian_chroot)}\u@\h: \w\a\]$PS1"
    ;;
*)
    ;;
esac

# enable color support of ls and also add handy aliases
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    #alias dir='dir --color=auto'
    #alias vdir='vdir --color=auto'

    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi

# some more ls aliases
alias ll='ls -alFh'
alias la='ls -A'
alias l='ls -CF'
alias gvim='gvim 2> /dev/null' # ignore gtk errors

# Add an "alert" alias for long running commands.  Use like so:
#   sleep 10; alert
alias alert='notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e '\''s/^\s*[0-9]\+\s*//;s/[;&|]\s*alert$//'\'')"'

# Alias definitions.
# You may want to put all your additions into a separate file like
# ~/.bash_aliases, instead of adding them here directly.
# See /usr/share/doc/bash-doc/examples in the bash-doc package.

if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

# enable programmable completion features (you don't need to enable
# this, if it's already enabled in /etc/bash.bashrc and /etc/profile
# sources /etc/bash.bashrc).
if [ -f /etc/bash_completion ] && ! shopt -oq posix; then
    . /etc/bash_completion
fi

function __try_paths() {
  for path in "$@"; do
    if [ -e "$path" ]; then
      echo "$path"
      return
    fi
  done
}

function s() {
  if [ $# -eq 0 ]; then
    exec sudo -s
  else
    sudo "$@"
  fi
}
function fname() {
  find . -iname '*'"$1"'*' "${@:2}"
}
if [ -x /bin/pacman ]; then
  alias pas='sudo pacman -S'
  alias pass='sudo pacman -Ss'
  alias pai='pacman -iQ'
  alias par='sudo pacman -R'
  alias yas='yaourt -S --noconfirm'
  alias yass='yaourt -Ss'
  alias yolo='sudo pacman -Syu'
else
  alias yolo='sudo apt-get update && sudo apt-get upgrade'
  alias pas='sudo apt-get install'
  alias pass='sudo apt-cache search'
  alias pai='apt-cache show'
  alias par='sudo apt-get purge'
  alias ll='ls -lh'
fi

alias pgr='ps aux | grep'
alias sys='sudo systemctl'
alias clip='xclip -selection clipboard'
alias clone='git clone'
alias gs='git status'
alias ga='git add'
alias gp='git push'
alias dif='git diff'
alias grebase='git fetch && git rebase'
alias pull='git pull'
alias greset='git checkout --'
# Just In Case, stash unstaged changes so I can run clean test on what I'm about to commit
alias jic='git stash --keep-index --include-untracked'
alias spop='git stash pop'
if [ -x /usr/bin/journalctl ]; then
  alias logf='sudo journalctl -fl'
else
  alias logf='sudo tail -f /var/log/messages'
fi
alias plusx='chmod +x'
alias wmon='watchd-monitor'
alias wgetr='wget -rc --no-parent -nH'
alias amend='git commit --amend'
function gc() {
  if [[ "$#" -eq 0 ]]; then
    git commit
  else
    git commit -m "$@"
  fi
}
function mangrep() {
  if [ ! $# -eq 2 ]; then
    echo "Example of usage: mangrep wget -r"
    return 1
  fi
  man -P 'less -p "^       '"$2"'"' $1
}
function topath() {
  export PATH="$1:$PATH"
}

export DJANGO=$(__try_paths \
  /usr/local/lib/python2.7/site-packages/django \
  /usr/local/lib/python2.7/dist-packages/django \
  /usr/lib/python2.7/site-packages/django \
  /usr/lib/python2.7/dist-packages/django \
)
function cmkdir() {
    mkdir "$1" && cd "$1"
}
function gvim() {
    (/usr/bin/gvim -f "$@" &)
}
function ppa() {
  sudo apt-add-repository "$1"
  sudo apt-get update
  sudo apt-get install -y "$2"
}
function ts-install() {
    tsd query "$1" --action install --save
}
function cmbuild() {
  mkdir -p "$1"
  PROJECT_DIR="$PWD"
  cd "$1"
  cmake "${@:2}" ..
}
function download_time() {
  qalc "($1Byte) / (${2:-120 k}Byte/s) to hours"
}
shopt -s autocd
shopt -s histappend
export DROPBOX="$HOME/Dropbox"

if which ack-grep > /dev/null 2>&1; then
  alias ack='ack-grep'
fi

COLOR_RESET="\[\e[m\]"
COLOR_RESET_NO_PS="\e[m"
COLOR_GREEN="\[\e[38;5;$((24+88))m\]"
COLOR_YELLOW="\[\e[38;5;$((196+32))m\]"
COLOR_BLUE="\[\e[38;5;$((22+52))m\]"
COLOR_RED="\[\e[38;5;$((196+7))m\]"
COLOR_RED_NO_PS="\e[38;5;$((196+7))m"
COLOR_ORANGE="\[\e[38;5;$((196+12))m\]"
COLOR_CYAN="\[\e[38;5;$((29+124))m\]"

PS_TIME="${COLOR_GREEN}[\$(date +%k:%M:%S)]${COLOR_RESET}"
PS_PWD="${COLOR_BLUE}\w${COLOR_RESET}"
PS_USER="${COLOR_YELLOW}\u@\h${COLOR_RESET}"
PS_STAR="${COLOR_ORANGE}$(echo -ne '\xe2\x98\x85')${COLOR_RESET}"
PS_SNOW="${COLOR_CYAN}$(echo -ne '\xe2\x9d\x85')${COLOR_RESET}"

PS_FIRST_TIME=true
function __prompt_command() {
  local ret=$?
  if $PS_FIRST_TIME; then
    PS_FIRST_TIME=false
  else
    # Show return code of previous command
    if [[ $ret != 0 ]]; then
      echo -e "${COLOR_RED_NO_PS}exited with code $ret ✘ ${COLOR_RESET_NO_PS}"
    fi

    # Print always a newline except if it's the first line
    echo
  fi

  local mode_string=""
  if [ ! -z "$SHELL_MODE" ]; then
    mode_string="${COLOR_CYAN}(${SHELL_MODE}) "
  fi

  PS1="${PS_TIME} ${mode_string}${PS_PWD}
${PS_USER}${COLOR_BLUE}❯ ${COLOR_RESET}"
}
PROMPT_COMMAND='__prompt_command'

PS1="${PS_TIME} ${PS_PWD}
${PS_USER}${COLOR_BLUE}❯ ${COLOR_RESET}"

DOTFILES_DIR=$( cd "$( dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd )
export PATH="$PATH:$DOTFILES_DIR/bin"

if [ -f "$HOME/.bashrc_local" ]; then
  . "$HOME/.bashrc_local"
fi

stty stop undef

# Needed so that the current directory is preserved across windows and tabs in
# some terminals.
if [ -f /etc/profile.d/vte.sh ]; then
  . /etc/profile.d/vte.sh
fi
