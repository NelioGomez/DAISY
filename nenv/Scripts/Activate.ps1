
# `nodeenv -p` appends this to the Activate.ps1 of the python virtualenv,
# which defines `deactivate` too: keep it and call it from ours instead
# of taking the name over for good
# https://github.com/ekalinin/nodeenv/issues/243
if ((Test-Path function:deactivate) -and
        -not (Test-Path function:_OLD_NODE_DEACTIVATE)) {
    copy-item function:deactivate function:global:_OLD_NODE_DEACTIVATE
}

function global:deactivate ([switch]$NonDestructive) {
    # Revert to original values
    if (Test-Path function:_OLD_VIRTUAL_PROMPT) {
        copy-item function:_OLD_VIRTUAL_PROMPT function:prompt
        remove-item function:_OLD_VIRTUAL_PROMPT
    }
    if (Test-Path env:_OLD_VIRTUAL_NODE_PATH) {
        copy-item env:_OLD_VIRTUAL_NODE_PATH env:NODE_PATH
        remove-item env:_OLD_VIRTUAL_NODE_PATH
    }
    if (Test-Path env:_OLD_VIRTUAL_PATH) {
        copy-item env:_OLD_VIRTUAL_PATH env:PATH
        remove-item env:_OLD_VIRTUAL_PATH
    }
    if (Test-Path env:NODE_VIRTUAL_ENV) {
        remove-item env:NODE_VIRTUAL_ENV
    }
    if (!$NonDestructive) {
        # Self destruct!
        remove-item function:deactivate
        # the python virtualenv's `deactivate` is next in line
        if (Test-Path function:_OLD_NODE_DEACTIVATE) {
            copy-item function:_OLD_NODE_DEACTIVATE function:global:deactivate
            remove-item function:_OLD_NODE_DEACTIVATE
            deactivate
        }
    }
}

deactivate -nondestructive
$env:NODE_VIRTUAL_ENV="E:\DAISY\nenv"

# Set the prompt to include the env name
# Make sure _OLD_VIRTUAL_PROMPT is global
function global:_OLD_VIRTUAL_PROMPT {""}
copy-item function:prompt function:_OLD_VIRTUAL_PROMPT
function global:prompt {
    Write-Host -NoNewline -ForegroundColor Green '(nenv) '
    _OLD_VIRTUAL_PROMPT
}

# Clear NODE_PATH
if (Test-Path env:NODE_PATH) {
    copy-item env:NODE_PATH env:_OLD_VIRTUAL_NODE_PATH
    remove-item env:NODE_PATH
}

# Add the venv to the PATH
copy-item env:PATH env:_OLD_VIRTUAL_PATH
$env:PATH = "$env:NODE_VIRTUAL_ENV\Scripts;$env:PATH"
