import os
import json
from typing import Union
from swarm_debug.core.models.Directory import Directory
from swarm_debug.core.DEFAULTS import DEFAULT_COLOR, DEFAULT_TOGGLED, DEFAULT_SET_MANUALLY, DEFAULT_SET_MANUALLY_COLOR, DEFAULT_SET_MANUALLY_EMOJI, DEFAULT_EMOJI, get_root_dir
from swarm_debug.core.data_dir import get_data_file
from swarm_debug.core.models.DebugFile import DebugFile
from collections import OrderedDict

def merge_directories(json_dir: Directory, scanned_dir: Directory):
    """
    Merges two Directory instances: one loaded from JSON (json_dir) and one built from scanning (scanned_dir).
    The values from json_dir take precedence where attributes overlap.
    It matches based on full directory and file structure, not just file names.
    """
    json_abspaths, json_instances = json_dir.get_ordered_abspaths_and_instances()
    scanned_abspaths, scanned_instances = scanned_dir.get_ordered_abspaths_and_instances()

    def find_matching_in_structure(scanned_child: Union[DebugFile, Directory], json_dir: Directory):
        assert json_dir in json_instances, f"JSON_DIR: {json_dir.path} not in json_instances"
        assert scanned_child in scanned_instances, f"SCANNED_CHILD: {scanned_child.path} not in scanned_instances"
        scanned_id = scanned_instances.index(scanned_child)
        scanned_abspath = scanned_abspaths[scanned_id]
        json_instance = None
        try:
            json_id = json_abspaths.index(scanned_abspath)
            json_instance = json_instances[json_id]
        except ValueError:
            pass
        return json_instance

    def construct_merged_dir(json_dir: Directory, scanned_dir: Directory):
        for scanned_child in scanned_dir.children:
            matching_json_child = find_matching_in_structure(scanned_child, json_dir)
            
            if isinstance(scanned_child, DebugFile) and matching_json_child:
                scanned_child.color = matching_json_child.color
                scanned_child.is_toggled = matching_json_child.is_toggled
                scanned_child.set_manually = matching_json_child.set_manually
                scanned_child.set_manually_color = matching_json_child.set_manually_color
                scanned_child.set_manually_emoji = matching_json_child.set_manually_emoji
                scanned_child.emoji = matching_json_child.emoji

            elif isinstance(scanned_child, Directory) and matching_json_child:
                scanned_child.color = matching_json_child.color
                scanned_child.is_toggled = matching_json_child.is_toggled
                scanned_child.set_manually = matching_json_child.set_manually
                scanned_child.set_manually_color = matching_json_child.set_manually_color
                scanned_child.set_manually_emoji = matching_json_child.set_manually_emoji
                scanned_child.emoji = matching_json_child.emoji

                construct_merged_dir(matching_json_child, scanned_child)
            else:
                scanned_child.color = DEFAULT_COLOR
                scanned_child.is_toggled = scanned_dir.is_toggled
                scanned_child.set_manually = DEFAULT_SET_MANUALLY
                scanned_child.set_manually_color = DEFAULT_SET_MANUALLY_COLOR
                scanned_child.set_manually_emoji = DEFAULT_SET_MANUALLY_EMOJI
                scanned_child.emoji = DEFAULT_EMOJI
    
    construct_merged_dir(json_dir, scanned_dir)


def update_debug_toggles(save_to_file=True) -> Directory:
    root = get_root_dir()
    toggle_file = get_data_file("debug_toggles.json", root)

    json_loaded_dir = None
    if os.path.exists(toggle_file):
        with open(toggle_file, 'r', encoding='utf-8') as file:
            try:
                json_data = json.load(file)
                if not json_data:
                    raise ValueError("Empty toggle file")
                json_loaded_dir = Directory(path="",
                                            color=json_data[0].get('color', DEFAULT_COLOR),
                                            is_toggled=json_data[0].get('is_toggled', DEFAULT_TOGGLED),
                                            set_manually=json_data[0].get('set_manually', DEFAULT_SET_MANUALLY),
                                            set_manually_color=json_data[0].get('set_manually_color', DEFAULT_SET_MANUALLY_COLOR),
                                            set_manually_emoji=json_data[0].get('set_manually_emoji', DEFAULT_SET_MANUALLY_EMOJI),
                                            emoji=json_data[0].get('emoji', DEFAULT_EMOJI)
                                            )

                json_loaded_dir.load_from_json(json_data[0]['children'])

            except (json.JSONDecodeError, ValueError, IndexError):
                json_loaded_dir = None
    else:
        from rich.console import Console
        Console(stderr=True).print("[dim]No JSON file found[/dim]")

    scanned_dir = Directory(path="", 
                            color=json_loaded_dir.color if json_loaded_dir else DEFAULT_COLOR, 
                            is_toggled=json_loaded_dir.is_toggled if json_loaded_dir else DEFAULT_TOGGLED, 
                            set_manually=json_loaded_dir.set_manually if json_loaded_dir else DEFAULT_SET_MANUALLY,
                            set_manually_color=json_loaded_dir.set_manually_color if json_loaded_dir else DEFAULT_SET_MANUALLY_COLOR,
                            set_manually_emoji=json_loaded_dir.set_manually_emoji if json_loaded_dir else DEFAULT_SET_MANUALLY_EMOJI,
                            emoji=json_loaded_dir.emoji if json_loaded_dir else DEFAULT_EMOJI
                            )
    scanned_dir.build_structure()
    scanned_dir.prune_empty()

    if json_loaded_dir:
        merge_directories(json_loaded_dir, scanned_dir)

    scanned_dir.propagate_toggled_state()
    scanned_dir.propagate_color()
    output = dir_to_output_format(scanned_dir)

    if save_to_file:
        with open(toggle_file, 'w', encoding='utf-8') as file:
             json.dump(output, file, ensure_ascii=False, indent=4)
    return scanned_dir

def dir_to_output_format(input_dir):
    root_node = {
        "name": "root",
        "color": input_dir.color,
        "is_toggled": input_dir.is_toggled,
        "set_manually": input_dir.set_manually,
        "set_manually_color": input_dir.set_manually_color,
        "set_manually_emoji": input_dir.set_manually_emoji,
        "emoji": input_dir.emoji,
        "children": input_dir.to_dict()["children"]
    }
    return [ordered(root_node)]

def ordered(obj):
    if isinstance(obj, dict):
        return OrderedDict((k, ordered(v)) for k, v in obj.items())
    if isinstance(obj, list):
        return [ordered(x) for x in obj]
    return obj
