#!/bin/zsh
set -eu
script_dir=${0:A:h}
project_dir=${script_dir:h:h}
"$project_dir/local-ai/.venv/bin/python" "$script_dir/gemini_compare.py" probe
