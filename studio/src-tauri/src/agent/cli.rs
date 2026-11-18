//! `doglog <resource> <action>` terminal commands, one for each agent command

use super::{API, block_on, bridge};
use clap::builder::PossibleValuesParser;
use clap::{Arg, ArgAction, ArgMatches, value_parser};
use serde_json::{Map, Value};
use std::process::ExitCode;

/// A subcommand for each resource, with one for each of its actions
pub fn subcommands() -> Vec<clap::Command> {
    let mut resources: Vec<(&str, Vec<clap::Command>)> = Vec::new();
    for command in &API.commands {
        let (resource, action) = split_name(&command.name);
        let subcommand = action_command(command, action);
        match resources.iter_mut().find(|(name, _)| *name == resource) {
            Some((_, actions)) => actions.push(subcommand),
            None => resources.push((resource, vec![subcommand])),
        }
    }
    resources
        .into_iter()
        .map(|(resource, actions)| {
            let names: Vec<_> = actions.iter().map(|action| action.get_name().to_owned()).collect();
            clap::Command::new(resource)
                .about(names.join(", "))
                .subcommand_required(true)
                .arg_required_else_help(true)
                .subcommands(actions)
        })
        .collect()
}

/// `pane_create` is the `create` action of the `pane` resource
fn split_name(name: &str) -> (&str, &str) {
    name.split_once('_').unwrap_or((name, name))
}

/// Run the command for `resource`, a subcommand from `subcommands()`
pub fn run(resource: &str, matches: &ArgMatches) -> ExitCode {
    let (action, matches) = matches.subcommand().expect("an action is required");
    let command = API
        .commands
        .iter()
        .find(|command| split_name(&command.name) == (resource, action))
        .expect("subcommands come from the commands");

    let result = input(command, matches).and_then(|args| {
        block_on(async {
            if command.bridge {
                bridge::window_list().await
            } else {
                let window = matches.get_one::<String>("window").map(String::as_str);
                bridge::call(&command.name, args.into(), window).await
            }
        })
    });
    match result {
        Ok(result) => {
            if matches.get_flag("json-output") {
                println!("{}", serde_json::to_string_pretty(&result).expect("results serialize"));
            } else if !result.is_null() {
                println!("{}", text(&result).join("\n"));
            }
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}

fn properties(command: &super::Command) -> impl Iterator<Item = (&String, &Value)> {
    command
        .input_schema
        .get("properties")
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
}

/// An action's flags, from its input's top-level properties that are simple enough to type
fn action_command(command: &super::Command, action: &str) -> clap::Command {
    let about = command.description.lines().next().unwrap_or_default();
    let mut subcommand = clap::Command::new(action.to_owned())
        .about(about.to_owned())
        .long_about(command.description.clone());
    let required: Vec<&str> = command
        .input_schema
        .get("required")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();

    let mut json_only = Vec::new();
    for (name, schema) in properties(command) {
        let Some(flag) = Flag::of(schema) else {
            json_only.push(name.as_str());
            continue;
        };
        let mut help = schema
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        if required.contains(&name.as_str()) {
            help.push_str(" (required)");
        }
        let arg = Arg::new(name.clone())
            .long(kebab_case(name))
            .value_name(kebab_case(name).replace('-', "_").to_uppercase())
            .help(help.trim().to_owned());
        let arg = match &flag.kind {
            // `--flag` alone is true
            Kind::Bool => arg
                .value_parser(value_parser!(bool))
                .num_args(0..=1)
                .default_missing_value("true"),
            Kind::Integer => arg.value_parser(value_parser!(i64)),
            Kind::Number => arg.value_parser(value_parser!(f64)),
            Kind::String => arg,
            Kind::Enum(values) => arg.value_parser(PossibleValuesParser::new(values)),
        };
        subcommand = subcommand.arg(if flag.many {
            arg.num_args(1..).action(ArgAction::Append)
        } else {
            arg
        });
    }

    if properties(command).next().is_some() {
        let mut help = "Input as JSON, inline, from a file with @path, or from standard input with -. Flags override its properties.".to_owned();
        if !json_only.is_empty() {
            help.push_str(&format!(" Use it for {}.", json_only.join(", ")));
        }
        subcommand = subcommand.arg(Arg::new("json").long("json").value_name("JSON").help(help));
    }
    if !command.bridge {
        subcommand =
            subcommand.arg(Arg::new("window").long("window").value_name("ID").help(
                "Window to run this in, from `doglog window list`. Defaults to the most recently focused window.",
            ));
    }
    subcommand.arg(
        Arg::new("json-output")
            .long("json-output")
            .action(ArgAction::SetTrue)
            .help("Print the result as JSON"),
    )
}

/// `dashboardId` is `--dashboard-id`
fn kebab_case(name: &str) -> String {
    let mut flag = String::new();
    for character in name.chars() {
        if character.is_ascii_uppercase() {
            flag.push('-');
        }
        flag.push(if character == '_' {
            '-'
        } else {
            character.to_ascii_lowercase()
        });
    }
    flag
}

enum Kind {
    Bool,
    Integer,
    Number,
    String,
    Enum(Vec<String>),
}

/// What a flag takes
struct Flag {
    kind: Kind,
    /// A list, given as several values
    many: bool,
}

impl Flag {
    fn of(schema: &Value) -> Option<Self> {
        let schema = non_null(schema);
        if schema.get("type").and_then(Value::as_str) == Some("array") {
            return Some(Self {
                kind: Kind::of(schema.get("items")?)?,
                many: true,
            });
        }
        Some(Self {
            kind: Kind::of(schema)?,
            many: false,
        })
    }
}

impl Kind {
    fn of(schema: &Value) -> Option<Self> {
        let schema = non_null(schema);
        if let Some(values) = schema.get("enum").and_then(Value::as_array) {
            return values
                .iter()
                .map(|value| value.as_str().map(str::to_owned))
                .collect::<Option<_>>()
                .map(Self::Enum);
        }
        match schema.get("type")?.as_str()? {
            "boolean" => Some(Self::Bool),
            "integer" => Some(Self::Integer),
            "number" => Some(Self::Number),
            "string" => Some(Self::String),
            _ => None,
        }
    }
}

/// A nullable schema's non-null type, since flags can't be null
fn non_null(schema: &Value) -> &Value {
    let options = schema.get("anyOf").and_then(Value::as_array).into_iter().flatten();
    let mut non_null = options.filter(|option| option.get("type").and_then(Value::as_str) != Some("null"));
    match (non_null.next(), non_null.next()) {
        (Some(option), None) => option,
        _ => schema,
    }
}

/// The command's input from `--json` and flags
fn input(command: &super::Command, matches: &ArgMatches) -> Result<Map<String, Value>, String> {
    let mut input = match matches.try_get_one::<String>("json").ok().flatten() {
        Some(json) => {
            let text = if json == "-" {
                std::io::read_to_string(std::io::stdin())
                    .map_err(|error| format!("Couldn't read standard input: {error}"))?
            } else if let Some(path) = json.strip_prefix('@') {
                std::fs::read_to_string(path).map_err(|error| format!("Couldn't read {path}: {error}"))?
            } else {
                json.clone()
            };
            match serde_json::from_str(&text) {
                Ok(Value::Object(input)) => input,
                Ok(_) => return Err("--json must be a JSON object".to_owned()),
                Err(error) => return Err(format!("--json isn't valid JSON: {error}")),
            }
        }
        None => Map::new(),
    };
    for (name, schema) in properties(command) {
        let Some(flag) = Flag::of(schema) else {
            continue;
        };
        let values: Option<Vec<Value>> = match flag.kind {
            Kind::Bool => values::<bool>(matches, name),
            Kind::Integer => values::<i64>(matches, name),
            Kind::Number => values::<f64>(matches, name),
            Kind::String | Kind::Enum(_) => values::<String>(matches, name),
        };
        if let Some(mut values) = values {
            input.insert(name.clone(), if flag.many { values.into() } else { values.remove(0) });
        }
    }
    Ok(input)
}

fn values<T: Clone + Send + Sync + Into<Value> + 'static>(matches: &ArgMatches, name: &str) -> Option<Vec<Value>> {
    Some(matches.get_many::<T>(name)?.cloned().map(Into::into).collect())
}

/// `value` as YAML-like lines, ex. a list of dashboards as `- id: …` with `name: …` below
fn text(value: &Value) -> Vec<String> {
    match value {
        Value::Object(object) if !object.is_empty() => object
            .iter()
            .flat_map(|(key, value)| match value {
                Value::Object(inner) if !inner.is_empty() => nested(key, value),
                Value::Array(inner) if !inner.is_empty() => nested(key, value),
                _ => vec![format!("{key}: {}", scalar(value))],
            })
            .collect(),
        Value::Array(items) if !items.is_empty() => items
            .iter()
            .flat_map(|item| {
                text(item).into_iter().enumerate().map(|(index, line)| {
                    if index == 0 {
                        format!("- {line}")
                    } else {
                        format!("  {line}")
                    }
                })
            })
            .collect(),
        _ => vec![scalar(value)],
    }
}

fn nested(key: &str, value: &Value) -> Vec<String> {
    std::iter::once(format!("{key}:"))
        .chain(text(value).into_iter().map(|line| format!("  {line}")))
        .collect()
}

fn scalar(value: &Value) -> String {
    match value {
        Value::String(string) => string.clone(),
        _ => value.to_string(),
    }
}
